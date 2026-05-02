"""
Medule - FastAPI Backend v2.2
AI: OpenRouter (free models) instead of Gemini
DB: MongoDB Atlas
"""

import os, json, uuid, shutil, logging, base64
from datetime import datetime, timezone
from typing import List, Optional

import pdfplumber
import httpx
from fastapi import FastAPI, File, UploadFile, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─── App ──────────────────────────────────────────────────
app = FastAPI(title="Medule API", version="2.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Config ───────────────────────────────────────────────
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_URL     = "https://openrouter.ai/api/v1/chat/completions"
# Free model that supports vision
VISION_MODEL = "openrouter/auto"
TEXT_MODEL   = "openrouter/auto"

UPLOAD_DIR   = "/tmp/medule_uploads"
MONGODB_URI  = os.getenv("MONGODB_URI", "")

os.makedirs(UPLOAD_DIR, exist_ok=True)

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
    text = text.strip()
    if "```" in text:
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
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

# ─── OpenRouter call ──────────────────────────────────────
async def call_openrouter(messages: list, model: str = None) -> str:
    """Call OpenRouter API and return text response."""
    if not OPENROUTER_API_KEY:
        raise HTTPException(status_code=503, detail="AI service not configured.")

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            OPENROUTER_URL,
            headers={
                "Authorization":  f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type":   "application/json",
                "HTTP-Referer":   "https://medule-1.onrender.com",
                "X-Title":        "Medule Health AI",
            },
            json={
                "model":    model or VISION_MODEL,
                "messages": messages,
                "max_tokens": 1500,
            },
        )

    if response.status_code != 200:
        logger.error(f"OpenRouter error: {response.text}")
        raise HTTPException(status_code=500, detail=f"AI service error: {response.status_code}")

    data = response.json()
    return data["choices"][0]["message"]["content"]

def image_to_base64(path: str, mime: str) -> str:
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")

# ─── Prompts ──────────────────────────────────────────────
FOOD_PROMPT = """You are an expert nutritionist AI. Analyze this food image.
Return ONLY a valid JSON object with NO explanation, NO markdown, NO code fences.

Exact structure required:
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

health_verdict must be exactly one of: Healthy, Moderate, Unhealthy
All array fields must have at least 1 item.
If no food visible, use food_name: "Unknown Food" with average values."""

DISEASE_PROMPT = """You are an expert medical AI assistant. Analyze this image or document.
Return ONLY a valid JSON object with NO explanation, NO markdown, NO code fences.

Exact structure required:
{
  "condition_name": "name of condition",
  "brief_description": "simple explanation in plain English",
  "severity": "Mild",
  "causes": ["cause 1", "cause 2"],
  "treatments": ["treatment 1", "treatment 2"],
  "risks": ["risk 1", "risk 2"],
  "see_doctor_if": ["warning sign 1", "warning sign 2"]
}

severity must be exactly one of: Mild, Moderate, Severe
All array fields must have at least 1 item.
If no condition visible, use condition_name: "No condition detected" and severity: "Mild".
This is AI analysis only — not a substitute for professional medical diagnosis."""

# ============================================================
# HEALTH CHECK
# ============================================================
@app.get("/")
async def root():
    return {"status": "ok", "service": "Medule API v2.2 (OpenRouter)"}

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

    temp_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}_{image.filename}")
    try:
        with open(temp_path, "wb") as fh:
            shutil.copyfileobj(image.file, fh)

        is_pdf = image.filename.lower().endswith(".pdf")

        if is_pdf:
            # Extract text from PDF
            text = ""
            with pdfplumber.open(temp_path) as pdf:
                for p in pdf.pages:
                    t = p.extract_text()
                    if t:
                        text += t + "\n"
            messages = [{"role": "user", "content": FOOD_PROMPT + f"\n\nDocument content:\n{text[:8000]}"}]
        else:
            # Send image as base64
            b64 = image_to_base64(temp_path, image.content_type)
            messages = [{
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:{image.content_type};base64,{b64}"}},
                    {"type": "text", "text": FOOD_PROMPT},
                ],
            }]

        raw = await call_openrouter(messages)
        result = json.loads(clean_json(raw))

        # Save to MongoDB
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
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e}")
        raise HTTPException(status_code=500, detail="AI returned invalid response. Please try again.")
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

    temp_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}_{image.filename}")
    try:
        with open(temp_path, "wb") as fh:
            shutil.copyfileobj(image.file, fh)

        is_pdf = image.filename.lower().endswith(".pdf")

        if is_pdf:
            text = ""
            with pdfplumber.open(temp_path) as pdf:
                for p in pdf.pages:
                    t = p.extract_text()
                    if t:
                        text += t + "\n"
            messages = [{"role": "user", "content": DISEASE_PROMPT + f"\n\nDocument content:\n{text[:8000]}"}]
        else:
            b64 = image_to_base64(temp_path, image.content_type)
            messages = [{
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:{image.content_type};base64,{b64}"}},
                    {"type": "text", "text": DISEASE_PROMPT},
                ],
            }]

        raw = await call_openrouter(messages)
        result = json.loads(clean_json(raw))

        # Save to MongoDB
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
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e}")
        raise HTTPException(status_code=500, detail="AI returned invalid response. Please try again.")
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
    doc["summary"] = f"Active: {session.active_minutes:.0f}m | Idle: {session.idle_minutes:.0f}m | Sessions: {session.sessions}"
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

    patient = await db.patients.find_one({"user_id": user_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")

    food_logs    = [d async for d in db.food_logs.find({"user_id": user_id}).sort("timestamp", -1).limit(10)]
    disease_logs = [d async for d in db.disease_logs.find({"user_id": user_id}).sort("timestamp", -1).limit(10)]
    habit_logs   = [d async for d in db.habit_logs.find({"user_id": user_id}).sort("logged_at", -1).limit(10)]

    prompt = f"""You are a health AI generating a Digital Twin health report.

Patient: {patient.get('patient_name', 'Unknown')}

Recent Food Logs:
{chr(10).join([d.get('summary','') for d in food_logs]) or 'No food data yet.'}

Recent Disease/Condition Logs:
{chr(10).join([d.get('summary','') for d in disease_logs]) or 'No disease data yet.'}

Recent Habit/Screen Time Logs:
{chr(10).join([d.get('summary','') for d in habit_logs]) or 'No habit data yet.'}

Write a health summary in exactly 3 paragraphs:
1. Overall health status based on food and nutrition patterns
2. Health conditions and risks identified
3. Lifestyle and habit assessment with actionable recommendations

Be warm, encouraging, and constructive. Use plain English."""

    messages = [{"role": "user", "content": prompt}]
    summary = await call_openrouter(messages, model=TEXT_MODEL)

    return {
        "patient_name":    patient.get("patient_name"),
        "ai_summary":      summary,
        "food_count":      patient.get("food_count", 0),
        "disease_count":   patient.get("disease_count", 0),
        "habit_count":     patient.get("habit_count", 0),
        "last_active":     patient.get("last_active"),
        "recent_food":     [serialize(d) for d in food_logs],
        "recent_diseases": [serialize(d) for d in disease_logs],
        "recent_habits":   [serialize(d) for d in habit_logs],
    }