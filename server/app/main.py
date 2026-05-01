"""
Medule - FastAPI Backend v2.1
Fix: removed response_schema from Gemini calls (not supported for complex types)
     using prompt-based JSON extraction instead
"""

import os, json, uuid, shutil, logging
from datetime import datetime, timezone
from typing import List, Optional

import pdfplumber
from fastapi import FastAPI, File, UploadFile, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
from google.genai import types

from motor.motor_asyncio import AsyncIOMotorClient
import httpx
from jose import jwt as jose_jwt, JWTError

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─── App ──────────────────────────────────────────────────
app = FastAPI(title="Medule API", version="2.1.0")

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
CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY", "")
CLERK_JWKS_URL   = "https://api.clerk.com/v1/jwks"

os.makedirs(UPLOAD_DIR, exist_ok=True)

# ─── Gemini client ────────────────────────────────────────
gemini_client = None
if GEMINI_API_KEY:
    gemini_client = genai.Client(api_key=GEMINI_API_KEY)

# ─── MongoDB ──────────────────────────────────────────────
mongo_client = None
db = None

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

# ─── Auth ─────────────────────────────────────────────────
_jwks_cache: dict = {}

async def get_clerk_jwks():
    global _jwks_cache
    if _jwks_cache:
        return _jwks_cache
    async with httpx.AsyncClient() as client:
        r = await client.get(CLERK_JWKS_URL, headers={"Authorization": f"Bearer {CLERK_SECRET_KEY}"})
        _jwks_cache = r.json()
    return _jwks_cache

# ─── Pydantic models ──────────────────────────────────────
class HabitSession(BaseModel):
    user_id:        str
    patient_name:   str
    date:           str
    active_minutes: float
    idle_minutes:   float
    total_minutes:  float
    sessions:       int

class ManualLogEntry(BaseModel):
    user_id:      str
    patient_name: str
    category:     str
    summary:      str

# ─── Helpers ──────────────────────────────────────────────
def serialize(doc) -> dict:
    if doc is None:
        return {}
    doc["_id"] = str(doc["_id"])
    return doc

def clean_json(text: str) -> str:
    """Strip markdown code fences if present."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]
        text = text.rsplit("```", 1)[0]
    return text.strip()

async def upsert_patient(user_id: str, patient_name: str):
    await db.patients.update_one(
        {"user_id": user_id},
        {"$setOnInsert": {
            "user_id":      user_id,
            "patient_name": patient_name,
            "created_at":   datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    await db.patients.update_one(
        {"user_id": user_id},
        {"$set": {"patient_name": patient_name, "last_active": datetime.now(timezone.utc).isoformat()}}
    )

# ─── Prompts ──────────────────────────────────────────────
FOOD_PROMPT = """
You are an expert nutritionist AI. Analyze this food image and return ONLY a valid JSON object.
No explanation, no markdown, no code fences — just raw JSON.

Return exactly this structure:
{
  "food_name": "name of the food",
  "calories": 350,
  "serving_size": "1 cup (240g)",
  "macronutrients": {"protein": 12, "carbs": 45, "fats": 8},
  "micronutrients": ["Vitamin C", "Iron", "Calcium"],
  "health_verdict": "Healthy",
  "health_benefits": ["benefit 1", "benefit 2"],
  "concerns": ["concern 1"],
  "alternatives": ["alternative 1"]
}

health_verdict must be one of: Healthy, Moderate, Unhealthy
If no food is visible, use food_name: "Unknown Food" with estimated average values.
"""

DISEASE_PROMPT = """
You are an expert medical AI assistant. Analyze this image and return ONLY a valid JSON object.
No explanation, no markdown, no code fences — just raw JSON.

Return exactly this structure:
{
  "condition_name": "name of condition",
  "brief_description": "simple explanation of what this condition is",
  "severity": "Mild",
  "causes": ["cause 1", "cause 2"],
  "treatments": ["treatment 1", "treatment 2"],
  "risks": ["risk 1", "risk 2"],
  "see_doctor_if": ["warning sign 1", "warning sign 2"]
}

severity must be one of: Mild, Moderate, Severe
If no medical condition is visible, use condition_name: "No condition detected" and severity: "Mild".
This is AI analysis only, not a substitute for professional medical diagnosis.
"""

# ============================================================
# HEALTH CHECK
# ============================================================
@app.get("/")
async def root():
    return {"status": "ok", "service": "Medule API v2.1"}

# ============================================================
# FOOD ANALYSIS
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

        http_opts = types.HttpOptions(timeout=30000)
        is_pdf = image.filename.lower().endswith(".pdf")

        if is_pdf:
            text = ""
            with pdfplumber.open(temp_path) as pdf:
                for p in pdf.pages:
                    t = p.extract_text()
                    if t:
                        text += t + "\n"
            response = gemini_client.models.generate_content(
                model=GEMINI_MODEL,
                contents=FOOD_PROMPT + f"\n\nDocument content:\n{text[:10000]}",
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
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
                    types.Part.from_text(text=FOOD_PROMPT),
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.1,
                    http_options=http_opts,
                ),
            )

        result = json.loads(clean_json(response.text))

        # Save to MongoDB if logged in
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
# DISEASE ANALYSIS
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

        http_opts = types.HttpOptions(timeout=30000)
        is_pdf = image.filename.lower().endswith(".pdf")

        if is_pdf:
            text = ""
            with pdfplumber.open(temp_path) as pdf:
                for p in pdf.pages:
                    t = p.extract_text()
                    if t:
                        text += t + "\n"
            response = gemini_client.models.generate_content(
                model=GEMINI_MODEL,
                contents=DISEASE_PROMPT + f"\n\nDocument content:\n{text[:10000]}",
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
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
                    types.Part.from_text(text=DISEASE_PROMPT),
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.1,
                    http_options=http_opts,
                ),
            )

        result = json.loads(clean_json(response.text))

        # Save to MongoDB if logged in
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
# HABIT / SCREEN TIME
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
    collection_map = {"food": "food_logs", "disease": "disease_logs", "habit": "habit_logs"}
    col = collection_map.get(entry.category)
    if not col:
        raise HTTPException(status_code=400, detail="category must be food, disease, or habit")
    await db[col].insert_one({
        "user_id":      entry.user_id,
        "patient_name": entry.patient_name,
        "timestamp":    datetime.now(timezone.utc).isoformat(),
        "summary":      entry.summary,
        "manual":       True,
    })
    await db.patients.update_one(
        {"user_id": entry.user_id},
        {"$inc": {f"{entry.category}_count": 1}, "$set": {"last_active": datetime.now(timezone.utc).isoformat()}}
    )
    return {"status": "saved"}

# ============================================================
# PATIENT MANAGEMENT
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

@app.get("/patient/{user_id}")
async def get_patient(user_id: str):
    if not db:
        raise HTTPException(status_code=503, detail="Database not configured.")
    patient = await db.patients.find_one({"user_id": user_id})
    if not patient:
        return {"user_id": user_id, "exists": False}
    food_logs    = [serialize(d) async for d in db.food_logs.find({"user_id": user_id}).sort("timestamp", -1).limit(20)]
    disease_logs = [serialize(d) async for d in db.disease_logs.find({"user_id": user_id}).sort("timestamp", -1).limit(20)]
    habit_logs   = [serialize(d) async for d in db.habit_logs.find({"user_id": user_id}).sort("logged_at", -1).limit(20)]
    return {**serialize(patient), "food_logs": food_logs, "disease_logs": disease_logs, "habit_logs": habit_logs}

# ============================================================
# DIGITAL TWIN
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

    food_logs    = [d async for d in db.food_logs.find({"user_id": user_id}).sort("timestamp", -1).limit(10)]
    disease_logs = [d async for d in db.disease_logs.find({"user_id": user_id}).sort("timestamp", -1).limit(10)]
    habit_logs   = [d async for d in db.habit_logs.find({"user_id": user_id}).sort("logged_at", -1).limit(10)]

    prompt = f"""
    You are a health AI generating a Digital Twin health report for a patient.

    Patient: {patient.get('patient_name', 'Unknown')}

    Recent Food Logs:
    {chr(10).join([d.get('summary','') for d in food_logs]) or 'No food data yet.'}

    Recent Disease/Condition Logs:
    {chr(10).join([d.get('summary','') for d in disease_logs]) or 'No disease data yet.'}

    Recent Habit/Screen Time Logs:
    {chr(10).join([d.get('summary','') for d in habit_logs]) or 'No habit data yet.'}

    Write a comprehensive but concise health summary in 3 paragraphs:
    1. Overall health status based on food and nutrition patterns
    2. Health conditions and risks identified
    3. Lifestyle and habit assessment with actionable recommendations

    Be warm, encouraging, and constructive. Use plain English.
    """

    response = gemini_client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.3,
            http_options=types.HttpOptions(timeout=30000)
        ),
    )

    return {
        "patient_name":    patient.get("patient_name"),
        "ai_summary":      response.text,
        "food_count":      patient.get("food_count", 0),
        "disease_count":   patient.get("disease_count", 0),
        "habit_count":     patient.get("habit_count", 0),
        "last_active":     patient.get("last_active"),
        "recent_food":     [serialize(d) for d in food_logs],
        "recent_diseases": [serialize(d) for d in disease_logs],
        "recent_habits":   [serialize(d) for d in habit_logs],
    }