"""
Medule - FastAPI Backend
Endpoints: food analysis, disease analysis, habit tracking,
           patient management, digital twin
DB: MongoDB Atlas via motor (async)
Auth: Clerk JWT verification
"""

import os, json, uuid, shutil, logging
from datetime import datetime, timezone
from typing import List, Optional

import pdfplumber
from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, Header, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from google import genai
from google.genai import types

# MongoDB
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

# Clerk JWT verification
import httpx
from jose import jwt as jose_jwt, JWTError

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─── App ──────────────────────────────────────────────────
app = FastAPI(title="Medule API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Config ───────────────────────────────────────────────
GEMINI_API_KEY   = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL     = "gemini-2.0-flash"
UPLOAD_DIR       = "/tmp/medule_uploads"
MONGODB_URI      = os.getenv("MONGODB_URI", "")
CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY", "")  # sk_test_...
CLERK_JWKS_URL   = "https://api.clerk.com/v1/jwks"

os.makedirs(UPLOAD_DIR, exist_ok=True)

# ─── Gemini client ────────────────────────────────────────
gemini_client = None
if GEMINI_API_KEY:
    gemini_client = genai.Client(api_key=GEMINI_API_KEY)

# ─── MongoDB ──────────────────────────────────────────────
mongo_client = None
db           = None

@app.on_event("startup")
async def startup():
    global mongo_client, db
    if MONGODB_URI:
        mongo_client = AsyncIOMotorClient(MONGODB_URI)
        db = mongo_client["medule"]
        logger.info("MongoDB connected")

@app.on_event("shutdown")
async def shutdown():
    if mongo_client:
        mongo_client.close()

# ─── Auth helpers ─────────────────────────────────────────
_jwks_cache: dict = {}

async def get_clerk_jwks():
    global _jwks_cache
    if _jwks_cache:
        return _jwks_cache
    async with httpx.AsyncClient() as client:
        r = await client.get(CLERK_JWKS_URL, headers={"Authorization": f"Bearer {CLERK_SECRET_KEY}"})
        _jwks_cache = r.json()
    return _jwks_cache

async def verify_clerk_token(authorization: str = Header(None)) -> dict:
    """Verify Clerk JWT and return payload with user_id and name."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.split(" ", 1)[1]
    try:
        jwks = await get_clerk_jwks()
        header = jose_jwt.get_unverified_header(token)
        key = next((k for k in jwks.get("keys", []) if k.get("kid") == header.get("kid")), None)
        if not key:
            raise HTTPException(status_code=401, detail="JWT key not found")
        payload = jose_jwt.decode(token, key, algorithms=["RS256"], options={"verify_aud": False})
        return payload
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")

# ─── Pydantic models ──────────────────────────────────────
class FoodResponse(BaseModel):
    food_name:       str       = Field(description="Name of the identified food")
    calories:        float     = Field(description="Estimated calories per serving")
    serving_size:    str       = Field(description="Typical serving size")
    macronutrients:  dict      = Field(description="Protein, carbs, fats in grams")
    micronutrients:  List[str] = Field(description="Key vitamins and minerals")
    health_verdict:  str       = Field(description="Overall healthiness: Healthy, Moderate, or Unhealthy")
    health_benefits: List[str] = Field(description="Health benefits of this food")
    concerns:        List[str] = Field(description="Any nutritional concerns")
    alternatives:    List[str] = Field(description="Healthier alternatives if applicable")

class DiseaseResponse(BaseModel):
    condition_name:    str       = Field(description="Name of the identified condition")
    brief_description: str       = Field(description="What this condition is in simple terms")
    severity:          str       = Field(description="One of: Mild, Moderate, Severe")
    causes:            List[str] = Field(description="List of common causes")
    treatments:        List[str] = Field(description="List of treatments and remedies")
    risks:             List[str] = Field(description="List of risks if untreated")
    see_doctor_if:     List[str] = Field(description="Warning signs needing immediate attention")

class HabitSession(BaseModel):
    user_id:          str
    patient_name:     str
    date:             str   # ISO date string
    active_minutes:   float
    idle_minutes:     float
    total_minutes:    float
    sessions:         int   # number of focus sessions

class ManualLogEntry(BaseModel):
    user_id:      str
    patient_name: str
    category:     str   # "food" | "disease" | "habit"
    summary:      str   # one-line summary

# ─── Helpers ──────────────────────────────────────────────
def serialize(doc) -> dict:
    """Convert MongoDB doc to JSON-serializable dict."""
    if doc is None:
        return {}
    doc["_id"] = str(doc["_id"])
    return doc

async def upsert_patient(user_id: str, patient_name: str):
    """Ensure patient record exists in DB."""
    await db.patients.update_one(
        {"user_id": user_id},
        {"$setOnInsert": {
            "user_id":      user_id,
            "patient_name": patient_name,
            "created_at":   datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    # Update name in case it changed
    await db.patients.update_one(
        {"user_id": user_id},
        {"$set": {"patient_name": patient_name, "last_active": datetime.now(timezone.utc).isoformat()}}
    )

# ============================================================
# HEALTH CHECK
# ============================================================
@app.get("/")
async def root():
    return {"status": "ok", "service": "Medule API v2"}

# ============================================================
# FOOD ANALYSIS  (existing — now also saves to patient record)
# ============================================================
@app.post("/analyze-food")
async def analyze_food(
    image: UploadFile = File(...),
    user_id:      Optional[str] = None,
    patient_name: Optional[str] = None,
):
    allowed = {"image/jpeg", "image/png", "image/webp", "image/bmp"}
    if image.content_type not in allowed and not image.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Upload JPG, PNG, WEBP, or PDF.")
    if not gemini_client:
        raise HTTPException(status_code=503, detail="AI service not configured.")

    temp_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}_{image.filename}")
    try:
        with open(temp_path, "wb") as fh:
            shutil.copyfileobj(image.file, fh)

        PROMPT = """
        You are an expert nutritionist AI. Analyze this food image and provide detailed
        nutritional information. Be accurate and specific about the food items visible.
        If multiple foods are present, focus on the main dish. If no food is visible,
        explain that in brief_description and use generic low values.
        """

        is_pdf = image.filename.lower().endswith(".pdf")
        http_opts = types.HttpOptions(timeout=30000)

        if is_pdf:
            text = ""
            with pdfplumber.open(temp_path) as pdf:
                for p in pdf.pages:
                    t = p.extract_text()
                    if t:
                        text += t + "\n"
            response = gemini_client.models.generate_content(
                model=GEMINI_MODEL,
                contents=PROMPT + f"\n\nDocument:\n{text[:10000]}",
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=FoodResponse,
                    temperature=0.1,
                    http_options=http_opts,
                ),
            )
        else:
            with open(temp_path, "rb") as img_file:
                img_bytes = img_file.read()
            response = gemini_client.models.generate_content(
                model=GEMINI_MODEL,
                contents=[
                    types.Part.from_bytes(data=img_bytes, mime_type=image.content_type),
                    types.Part.from_text(text=PROMPT),
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=FoodResponse,
                    temperature=0.1,
                    http_options=http_opts,
                ),
            )

        result = json.loads(response.text)

        # Auto-save to patient record if logged in
        if db and user_id and patient_name:
            await upsert_patient(user_id, patient_name)
            await db.food_logs.insert_one({
                "user_id":      user_id,
                "patient_name": patient_name,
                "timestamp":    datetime.now(timezone.utc).isoformat(),
                "food_name":    result.get("food_name", "Unknown"),
                "calories":     result.get("calories", 0),
                "verdict":      result.get("health_verdict", ""),
                "summary":      f"{result.get('food_name','?')} — {result.get('calories','?')} kcal — {result.get('health_verdict','')}",
                "full_result":  result,
            })
            await db.patients.update_one(
                {"user_id": user_id},
                {"$inc": {"food_count": 1}, "$set": {"last_active": datetime.now(timezone.utc).isoformat()}}
            )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Food analysis error: {e}")
        raise HTTPException(status_code=500, detail="Failed to analyze food. Please try again.")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

# ============================================================
# DISEASE ANALYSIS  (new — saves to patient record)
# ============================================================
@app.post("/analyze-disease")
async def analyze_disease(
    image: UploadFile = File(...),
    user_id:      Optional[str] = None,
    patient_name: Optional[str] = None,
):
    allowed = {"image/jpeg", "image/png", "image/webp", "image/bmp"}
    if image.content_type not in allowed and not image.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Upload JPG, PNG, WEBP, or PDF.")
    if not gemini_client:
        raise HTTPException(status_code=503, detail="AI service not configured.")

    temp_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}_{image.filename}")
    try:
        with open(temp_path, "wb") as fh:
            shutil.copyfileobj(image.file, fh)

        PROMPT = """
        You are an expert medical AI assistant. Analyze this image and identify any visible
        medical condition — skin condition, eye condition, wound, rash, lesion, infection,
        or any other visible health issue. Be accurate, clear and helpful.
        If no condition is visible or the image is unrelated to health, respond with
        condition_name: "No condition detected", severity: "Mild".
        Always note this is AI analysis, not a substitute for professional diagnosis.
        """

        is_pdf = image.filename.lower().endswith(".pdf")
        http_opts = types.HttpOptions(timeout=30000)

        if is_pdf:
            text = ""
            with pdfplumber.open(temp_path) as pdf:
                for p in pdf.pages:
                    t = p.extract_text()
                    if t:
                        text += t + "\n"
            response = gemini_client.models.generate_content(
                model=GEMINI_MODEL,
                contents=PROMPT + f"\n\nDocument:\n{text[:10000]}",
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=DiseaseResponse,
                    temperature=0.1,
                    http_options=http_opts,
                ),
            )
        else:
            with open(temp_path, "rb") as img_file:
                img_bytes = img_file.read()
            response = gemini_client.models.generate_content(
                model=GEMINI_MODEL,
                contents=[
                    types.Part.from_bytes(data=img_bytes, mime_type=image.content_type),
                    types.Part.from_text(text=PROMPT),
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=DiseaseResponse,
                    temperature=0.1,
                    http_options=http_opts,
                ),
            )

        result = json.loads(response.text)

        # Auto-save to patient record
        if db and user_id and patient_name:
            await upsert_patient(user_id, patient_name)
            await db.disease_logs.insert_one({
                "user_id":        user_id,
                "patient_name":   patient_name,
                "timestamp":      datetime.now(timezone.utc).isoformat(),
                "condition_name": result.get("condition_name", "Unknown"),
                "severity":       result.get("severity", ""),
                "summary":        f"{result.get('condition_name','?')} — Severity: {result.get('severity','')}",
                "full_result":    result,
            })
            await db.patients.update_one(
                {"user_id": user_id},
                {"$inc": {"disease_count": 1}, "$set": {"last_active": datetime.now(timezone.utc).isoformat()}}
            )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Disease analysis error: {e}")
        raise HTTPException(status_code=500, detail="Failed to analyze image. Please try again.")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

# ============================================================
# HABIT / SCREEN TIME  (save session)
# ============================================================
@app.post("/log-habit")
async def log_habit(session: HabitSession):
    if not db:
        raise HTTPException(status_code=503, detail="Database not configured.")
    await upsert_patient(session.user_id, session.patient_name)
    doc = session.model_dump()
    doc["logged_at"] = datetime.now(timezone.utc).isoformat()
    doc["summary"] = (
        f"Active: {session.active_minutes:.0f}m | "
        f"Idle: {session.idle_minutes:.0f}m | "
        f"Sessions: {session.sessions}"
    )
    await db.habit_logs.insert_one(doc)
    await db.patients.update_one(
        {"user_id": session.user_id},
        {"$inc": {"habit_count": 1}, "$set": {"last_active": datetime.now(timezone.utc).isoformat()}}
    )
    return {"status": "saved"}

# ============================================================
# MANUAL LOG ENTRY
# ============================================================
@app.post("/log-manual")
async def log_manual(entry: ManualLogEntry):
    if not db:
        raise HTTPException(status_code=503, detail="Database not configured.")
    await upsert_patient(entry.user_id, entry.patient_name)
    collection_map = {
        "food":    "food_logs",
        "disease": "disease_logs",
        "habit":   "habit_logs",
    }
    col = collection_map.get(entry.category)
    if not col:
        raise HTTPException(status_code=400, detail="category must be food, disease, or habit")
    doc = {
        "user_id":      entry.user_id,
        "patient_name": entry.patient_name,
        "timestamp":    datetime.now(timezone.utc).isoformat(),
        "summary":      entry.summary,
        "manual":       True,
    }
    await db[col].insert_one(doc)
    count_field = f"{entry.category}_count"
    await db.patients.update_one(
        {"user_id": entry.user_id},
        {"$inc": {count_field: 1}, "$set": {"last_active": datetime.now(timezone.utc).isoformat()}}
    )
    return {"status": "saved"}

# ============================================================
# PATIENT MANAGEMENT — get all patients (admin)
# ============================================================
@app.get("/patients")
async def get_all_patients():
    if not db:
        raise HTTPException(status_code=503, detail="Database not configured.")
    cursor = db.patients.find().sort("last_active", -1)
    patients = []
    async for doc in cursor:
        patients.append(serialize(doc))
    return patients

# ============================================================
# PATIENT DETAIL — full record for one user
# ============================================================
@app.get("/patient/{user_id}")
async def get_patient(user_id: str):
    if not db:
        raise HTTPException(status_code=503, detail="Database not configured.")

    patient = await db.patients.find_one({"user_id": user_id})
    if not patient:
        return {"user_id": user_id, "exists": False}

    # Fetch last 20 logs from each collection
    food_cursor    = db.food_logs.find({"user_id": user_id}).sort("timestamp", -1).limit(20)
    disease_cursor = db.disease_logs.find({"user_id": user_id}).sort("timestamp", -1).limit(20)
    habit_cursor   = db.habit_logs.find({"user_id": user_id}).sort("logged_at", -1).limit(20)

    food_logs    = [serialize(d) async for d in food_cursor]
    disease_logs = [serialize(d) async for d in disease_cursor]
    habit_logs   = [serialize(d) async for d in habit_cursor]

    return {
        **serialize(patient),
        "food_logs":    food_logs,
        "disease_logs": disease_logs,
        "habit_logs":   habit_logs,
    }

# ============================================================
# DIGITAL TWIN — AI health summary for a user
# ============================================================
@app.get("/digital-twin/{user_id}")
async def digital_twin_summary(user_id: str):
    if not db:
        raise HTTPException(status_code=503, detail="Database not configured.")
    if not gemini_client:
        raise HTTPException(status_code=503, detail="AI service not configured.")

    patient = await db.patients.find_one({"user_id": user_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")

    # Gather recent data
    food_cursor    = db.food_logs.find({"user_id": user_id}).sort("timestamp", -1).limit(10)
    disease_cursor = db.disease_logs.find({"user_id": user_id}).sort("timestamp", -1).limit(10)
    habit_cursor   = db.habit_logs.find({"user_id": user_id}).sort("logged_at", -1).limit(10)

    food_logs    = [d async for d in food_cursor]
    disease_logs = [d async for d in disease_cursor]
    habit_logs   = [d async for d in habit_cursor]

    food_summaries    = [d.get("summary", "") for d in food_logs]
    disease_summaries = [d.get("summary", "") for d in disease_logs]
    habit_summaries   = [d.get("summary", "") for d in habit_logs]

    prompt = f"""
    You are a health AI generating a Digital Twin health report for a patient.
    
    Patient: {patient.get('patient_name', 'Unknown')}
    
    Recent Food Logs:
    {chr(10).join(food_summaries) or 'No food data yet.'}
    
    Recent Disease/Condition Logs:
    {chr(10).join(disease_summaries) or 'No disease data yet.'}
    
    Recent Habit/Screen Time Logs:
    {chr(10).join(habit_summaries) or 'No habit data yet.'}
    
    Write a comprehensive but concise health summary in 3 paragraphs:
    1. Overall health status based on food and nutrition patterns
    2. Health conditions and risks identified
    3. Lifestyle and habit assessment with actionable recommendations
    
    Be warm, encouraging, and constructive. Use plain English.
    """

    response = gemini_client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(temperature=0.3, http_options=types.HttpOptions(timeout=30000)),
    )

    return {
        "patient_name":       patient.get("patient_name"),
        "ai_summary":         response.text,
        "food_count":         patient.get("food_count", 0),
        "disease_count":      patient.get("disease_count", 0),
        "habit_count":        patient.get("habit_count", 0),
        "last_active":        patient.get("last_active"),
        "recent_food":        [serialize(d) for d in food_logs],
        "recent_diseases":    [serialize(d) for d in disease_logs],
        "recent_habits":      [serialize(d) for d in habit_logs],
    }
