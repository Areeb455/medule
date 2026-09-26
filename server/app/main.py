"""
Medule - FastAPI Backend v2.2
AI: OpenRouter (free models)
DB: MongoDB Atlas
"""

import os, json, uuid, shutil, logging, base64, io
from dotenv import load_dotenv
# Load .env from project root
load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.env")))
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
import httpx

try:
    import pdfplumber
except ImportError:
    pdfplumber = None
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─── Config ───────────────────────────────────────────────
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_URL     = "https://openrouter.ai/api/v1/chat/completions"
VISION_MODEL       = "openrouter/auto"
TEXT_MODEL         = "openrouter/auto"
GEMINI_API_KEY     = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL       = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
UPLOAD_DIR         = "/tmp/medule_uploads"
MONGODB_URI        = os.getenv("MONGODB_URI", "")

os.makedirs(UPLOAD_DIR, exist_ok=True)

# ─── MongoDB globals ──────────────────────────────────────
mongo_client = None
db = None

# ─── Lifespan ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global mongo_client, db
    logger.info(f"MONGODB_URI present: {bool(MONGODB_URI)}")
    if MONGODB_URI:
        try:
            kwargs = {}
            if os.name == "nt":
                kwargs["tlsAllowInvalidCertificates"] = True
            mongo_client = AsyncIOMotorClient(MONGODB_URI, **kwargs)
            db = mongo_client["medule"]
            await mongo_client.admin.command("ping")
            logger.info("MongoDB connected successfully")
        except Exception as e:
            logger.error(f"MongoDB connection failed: {e}")
    else:
        logger.error("MONGODB_URI is empty — check Render environment variables")
    yield
    if mongo_client:
        mongo_client.close()
        logger.info("MongoDB disconnected")

# ─── App ──────────────────────────────────────────────────
app = FastAPI(title="Medule API", version="2.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://medule.health",
        "https://www.medule.health",
        "https://medule-1.onrender.com",
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

class VitalsInput(BaseModel):
    user_id:      str
    patient_name: str
    vitals:       dict
    bmi:          Optional[float] = None

# ─── Helpers ──────────────────────────────────────────────
def serialize(doc) -> dict:
    if doc is None:
        return {}
    doc["_id"] = str(doc["_id"])
    return doc

def clean_json(text: str) -> str:
    text = text.strip()
    if "```" in text:
        parts = text.split("```")
        for part in parts:
            p = part.strip()
            if p.startswith("json"):
                p = p[4:].strip()
            if p.startswith("{") and p.endswith("}"):
                return p
    first_brace = text.find("{")
    last_brace = text.rfind("}")
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        return text[first_brace:last_brace + 1].strip()
    return text

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

AVAILABLE_GEMINI_MODELS = []
GEMINI_MODELS_RAW_RESPONSE = None

async def get_available_gemini_models() -> list:
    global AVAILABLE_GEMINI_MODELS, GEMINI_MODELS_RAW_RESPONSE
    if AVAILABLE_GEMINI_MODELS:
        return AVAILABLE_GEMINI_MODELS
    if not GEMINI_API_KEY:
        return []
    api_key = GEMINI_API_KEY.strip().strip('"').strip("'")
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(url)
            GEMINI_MODELS_RAW_RESPONSE = f"status: {r.status_code}, body: {r.text[:300]}"
            if r.status_code == 200:
                data = r.json()
                models = [
                    m["name"].replace("models/", "")
                    for m in data.get("models", [])
                    if "generateContent" in m.get("supportedGenerationMethods", [])
                ]
                AVAILABLE_GEMINI_MODELS = models
                return models
    except Exception as e:
        GEMINI_MODELS_RAW_RESPONSE = f"exception: {str(e)}"
    return []

# ─── Gemini REST API Fallback ─────────────────────────────
async def call_gemini_rest(messages: list, model: str = None) -> str:
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="Gemini API key not configured.")
    
    api_key = GEMINI_API_KEY.strip().strip('"').strip("'")
    target_model = model or GEMINI_MODEL
    if target_model.startswith("models/"):
        target_model = target_model[7:]
    if "/" in target_model or "2.5" in target_model:
        target_model = "gemini-1.5-flash"

    # Dynamically discover supported models from Google ModelService
    dynamic_models = await get_available_gemini_models()
    if dynamic_models:
        flash_models = [m for m in dynamic_models if "flash" in m]
        other_models = [m for m in dynamic_models if "flash" not in m]
        candidate_models = flash_models + other_models
    else:
        candidate_models = [target_model, "gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-flash-latest", "gemini-1.5-pro"]

    seen = set()
    models_to_try = [m for m in candidate_models if m and not (m in seen or seen.add(m))]

    parts = []
    for msg in messages:
        content = msg.get("content", "")
        if isinstance(content, str):
            parts.append({"text": content})
        elif isinstance(content, list):
            for item in content:
                if item.get("type") == "text":
                    parts.append({"text": item.get("text", "")})
                elif item.get("type") == "image_url":
                    url = item.get("image_url", {}).get("url", "")
                    if "base64," in url:
                        prefix, b64_str = url.split("base64,", 1)
                        mime_type = prefix.split(":")[1].split(";")[0]
                        parts.append({
                            "inlineData": {
                                "mimeType": mime_type,
                                "data": b64_str
                            }
                        })
                    else:
                        parts.append({"text": f"[Image Attachment: {url}]"})

    last_error = ""
    for candidate in models_to_try:
        if "/" in candidate:
            continue
        for api_version in ["v1beta", "v1"]:
            url = f"https://generativelanguage.googleapis.com/{api_version}/models/{candidate}:generateContent?key={api_key}"
            try:
                async with httpx.AsyncClient(timeout=45) as client:
                    response = await client.post(
                        url,
                        headers={"Content-Type": "application/json"},
                        json={"contents": [{"parts": parts}]}
                    )
                if response.status_code == 200:
                    res_json = response.json()
                    try:
                        return res_json["candidates"][0]["content"]["parts"][0]["text"]
                    except (KeyError, IndexError) as e:
                        logger.error(f"Unexpected Gemini REST response structure: {res_json}")
                        continue
                else:
                    last_error = f"{candidate} ({api_version}): {response.status_code} - {response.text[:200]}"
                    logger.warning(f"Gemini {candidate} ({api_version}) returned {response.status_code}: {response.text[:200]}")
            except Exception as req_err:
                last_error = f"{candidate}: {req_err}"
                logger.warning(f"Gemini request error for {candidate}: {req_err}")

    raise HTTPException(status_code=500, detail=f"Gemini API error: {last_error}")

# ─── OpenRouter ───────────────────────────────────────────
async def call_openrouter(messages: list, model: str = None) -> str:
    openrouter_errors = []
    if OPENROUTER_API_KEY:
        api_key = OPENROUTER_API_KEY.strip().strip('"').strip("'")
        primary_model = model or VISION_MODEL
        models_to_try = [primary_model]
        if "free" not in primary_model:
            models_to_try.extend([
                "google/gemini-2.0-flash-exp:free",
                "meta-llama/llama-3.3-70b-instruct:free",
                "qwen/qwen-2.5-72b-instruct:free"
            ])

        for m in models_to_try:
            try:
                async with httpx.AsyncClient(timeout=25) as client:
                    response = await client.post(
                        OPENROUTER_URL,
                        headers={
                            "Authorization": f"Bearer {api_key}",
                            "Content-Type":  "application/json",
                            "HTTP-Referer":  "https://medule-1.onrender.com",
                            "X-Title":       "Medule Health AI",
                        },
                        json={
                            "model":      m,
                            "messages":   messages,
                            "max_tokens": 4000,
                        },
                    )
                if response.status_code == 200:
                    return response.json()["choices"][0]["message"]["content"]
                else:
                    openrouter_errors.append(f"{m}: {response.status_code} {response.text[:100]}")
                    logger.warning(f"OpenRouter model {m} returned status {response.status_code}: {response.text[:200]}. Trying fallback...")
            except Exception as e:
                openrouter_errors.append(f"{m}: {str(e)[:100]}")
                logger.warning(f"OpenRouter request failed for {m}: {e}. Trying fallback...")

    # Fallback to Gemini if OpenRouter is unconfigured, failed, or out of credits
    if GEMINI_API_KEY:
        logger.info("Using Gemini REST API fallback...")
        return await call_gemini_rest(messages, model)
        
    error_summary = " | ".join(openrouter_errors) if openrouter_errors else "AI service not configured."
    raise HTTPException(status_code=503, detail=f"AI service unavailable: {error_summary}")

def image_to_base64(path: str) -> str:
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")

def process_pdf_file(temp_path: str, prompt: str) -> list:
    """
    Extracts text and/or page images from a PDF file.
    Handles digital text PDFs, scanned image PDFs, and hybrid documents.
    """
    text = ""
    page_images_b64 = []

    if pdfplumber is not None:
        try:
            with pdfplumber.open(temp_path) as pdf:
                for p in pdf.pages:
                    try:
                        t = p.extract_text()
                        if t:
                            text += t + "\n"
                    except Exception as te:
                        logger.warning(f"Error extracting text from PDF page: {te}")

                # If text is empty or very short (< 60 chars), this is a scanned PDF or disease scan in PDF
                if len(text.strip()) < 60:
                    logger.info("PDF has minimal text (<60 chars). Rendering pages to images for vision analysis...")
                    for p in pdf.pages[:5]:
                        try:
                            pil_img = p.to_image(resolution=150).original
                            buf = io.BytesIO()
                            pil_img.save(buf, format="JPEG", quality=85)
                            b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
                            page_images_b64.append(b64)
                        except Exception as render_err:
                            logger.warning(f"Could not render PDF page to image: {render_err}")
        except Exception as e:
            logger.warning(f"pdfplumber failed: {e}")

    # If we extracted page images (scanned document)
    if page_images_b64:
        content_items = []
        for b64 in page_images_b64:
            content_items.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{b64}"}
            })
        extra_note = f"\n\nExtracted text:\n{text[:6000]}" if text.strip() else ""
        content_items.append({
            "type": "text",
            "text": prompt + extra_note
        })
        return [{"role": "user", "content": content_items}]

    # If digital text was extracted successfully
    if text.strip():
        return [{"role": "user", "content": prompt + f"\n\nDocument content:\n{text[:16000]}"}]

    # Fallback if both text and rendering failed: pass raw PDF as base64 for Gemini inlineData
    with open(temp_path, "rb") as f:
        raw_b64 = base64.b64encode(f.read()).decode("utf-8")
    return [{
        "role": "user",
        "content": [
            {"type": "image_url", "image_url": {"url": f"data:application/pdf;base64,{raw_b64}"}},
            {"type": "text", "text": prompt}
        ]
    }]

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

FOOD_TEXT_PROMPT = """You are an expert nutritionist AI. Analyze the food based on its name.
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

CRITICAL RULES:
- health_verdict must be exactly one of: Healthy, Moderate, Unhealthy
- All array fields must have at least 1 item.
- Provide reasonable estimated nutritional values based on standard serving sizes for this food item.
- If the food name is unclear or unrecognizable, return food_name "Unknown Food" with calories: 0, macronutrients: {"protein": 0, "carbs": 0, "fats": 0}, micronutrients: [], health_verdict: "Moderate", health_benefits: ["Unable to analyze — food not recognized"], concerns: ["Please provide a clearer food name"], alternatives: ["Try describing your meal more specifically"]."""

DISEASE_PROMPT = """You are an expert medical report analyst AI. You specialize in analyzing COMPLETE medical reports including blood tests, urine tests, health checkups, pathology reports, diagnostic reports, and any medical documents.

Analyze this medical report thoroughly and extract ALL information. This is NOT just looking for diseases - it's about understanding the patient's complete health status.

Return ONLY a valid JSON object with NO explanation, NO markdown, NO code fences.

Exact structure required:
{
  "condition_name": "Primary finding or 'Complete Health Report' if comprehensive summary",
  "brief_description": "Detailed 3-4 sentence explanation of what this report shows about the patient's health",
  "severity": "Mild",
  "causes": ["Age-related factors if applicable", "Lifestyle factors", "Medical conditions contributing to findings", "Specific parameters that are abnormal and why"],
  "treatments": ["Specific treatment recommendations", "Lifestyle changes needed", "Medications if prescribed", "Follow-up tests needed"],
  "risks": ["Health risks based on current findings", "Long-term risks if untreated", "Risk factors identified"],
  "see_doctor_if": ["Warning signs to watch for", "Symptoms that need immediate attention", "When to retest"],
  "report_summary": "DETAILED comprehensive summary - list EVERY test parameter, its value, normal range, and status (normal/abnormal). Include: complete blood count values, lipid profile, liver function, kidney function, thyroid, diabetes tests, urine analysis, vitals, BMI, and ALL other metrics found. Write at least 10-15 sentences covering everything."
}

CRITICAL RULES:
- severity must be exactly one of: Mild, Moderate, Severe
- ALL array fields must have at least 3 items
- This is a COMPREHENSIVE medical report - you MUST extract EVERY piece of information
- For EACH test parameter, mention: the value, normal range, and whether it's normal/abnormal
- List specific numeric values: HbA1c, fasting glucose, total cholesterol, LDL, HDL, triglycerides, creatinine, BUN, ALT, AST, TSH, T3, T4, vitamin D, vitamin B12, iron, ferritin, WBC, RBC, hemoglobin, platelets, etc.
- For abnormal values, explain WHAT it means for health
- Include demographic context if mentioned (age, gender affects normal ranges)
- For "causes" field: be specific - if patient is 45 years old and has high sugar, say "Age-related metabolic changes combined with lifestyle factors" not just generic causes
- The report_summary should be paragraphs of detailed information, NOT just bullet points
- If everything is normal, still list every normal value with "within normal limits"
- NEVER say "No condition detected" - instead provide full health summary
- This is AI analysis only — not a substitute for professional medical diagnosis."""

# ============================================================
# HEALTH CHECK
# ============================================================
@app.get("/")
async def root():
    return {"status": "ok", "service": "Medule API v2.3 (Multi-Model Resilient)"}

@app.get("/health-ai")
async def health_ai():
    models = await get_available_gemini_models()
    results = {
        "gemini_list_models_result": GEMINI_MODELS_RAW_RESPONSE,
        "available_gemini_models": models,
    }
    test_msg = [{"role": "user", "content": "Respond with the word OK."}]
    if OPENROUTER_API_KEY:
        try:
            res = await call_openrouter(test_msg)
            results["openrouter"] = {"status": "ok", "response": res[:50]}
        except Exception as e:
            results["openrouter"] = {"status": "error", "error": str(e)}
    else:
        results["openrouter"] = {"status": "not_configured"}

    if GEMINI_API_KEY:
        try:
            res = await call_gemini_rest(test_msg)
            results["gemini"] = {"status": "ok", "response": res[:50]}
        except Exception as e:
            results["gemini"] = {"status": "error", "error": str(e)}
    else:
        results["gemini"] = {"status": "not_configured"}

    return results

# ============================================================
# FOOD ANALYSIS
# ============================================================
@app.post("/analyze-food")
async def analyze_food(
    image: UploadFile = File(...),
    user_id:      Optional[str] = Form(None),
    patient_name: Optional[str] = Form(None),
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
            messages = process_pdf_file(temp_path, FOOD_PROMPT)
        else:
            b64 = image_to_base64(temp_path)
            messages = [{
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:{image.content_type};base64,{b64}"}},
                    {"type": "text", "text": FOOD_PROMPT},
                ],
            }]

        raw = await call_openrouter(messages, model=VISION_MODEL)
        result = json.loads(clean_json(raw))

        if db is not None and user_id and patient_name:
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
            logger.info(f"Food saved for {patient_name}")

        return result

    except HTTPException:
        raise
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e}")
        raise HTTPException(status_code=500, detail=f"AI returned invalid format: {str(e)[:100]}")
    except Exception as e:
        logger.error(f"Food analysis error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to analyze food: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

# ============================================================
# FOOD ANALYSIS (TEXT/BASED)
# ============================================================
class FoodTextInput(BaseModel):
    food_name: str
    user_id: Optional[str] = None
    patient_name: Optional[str] = None

@app.post("/analyze-food-text")
async def analyze_food_text(input: FoodTextInput):
    if not input.food_name or len(input.food_name.strip()) < 2:
        raise HTTPException(status_code=400, detail="Please provide a food name.")

    try:
        messages = [{"role": "user", "content": FOOD_TEXT_PROMPT + f"\n\nFood name: {input.food_name.strip()}"}]
        raw = await call_openrouter(messages)
        result = json.loads(clean_json(raw))
        result["food_name"] = input.food_name.strip()

        if db is not None and input.user_id and input.patient_name:
            await upsert_patient(input.user_id, input.patient_name)
            await db.food_logs.insert_one({
                "user_id":       input.user_id,
                "patient_name":  input.patient_name,
                "timestamp":     datetime.now(timezone.utc).isoformat(),
                "food_name":     result.get("food_name", "Unknown"),
                "calories":      result.get("calories", 0),
                "verdict":       result.get("health_verdict", ""),
                "summary":       f"{result.get('food_name','?')} — {result.get('calories','?')} kcal — {result.get('health_verdict','')}",
                "full_result":   result,
                "entry_type":    "manual",
            })
            await db.patients.update_one(
                {"user_id": input.user_id},
                {"$inc": {"food_count": 1}, "$set": {"last_active": datetime.now(timezone.utc).isoformat()}}
            )
            logger.info(f"Manual food saved for {input.patient_name}")

        return result

    except HTTPException:
        raise
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e}")
        raise HTTPException(status_code=500, detail="AI returned invalid response. Please try again.")
    except Exception as e:
        logger.error(f"Food text analysis error: {e}")
        raise HTTPException(status_code=500, detail="Failed to analyze food. Please try again.")

# ============================================================
# DISEASE ANALYSIS
# ============================================================
@app.post("/analyze-disease")
async def analyze_disease(
    image: UploadFile = File(...),
    user_id:      Optional[str] = Form(None),
    patient_name: Optional[str] = Form(None),
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
            messages = process_pdf_file(temp_path, DISEASE_PROMPT)
        else:
            b64 = image_to_base64(temp_path)
            messages = [{
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:{image.content_type};base64,{b64}"}},
                    {"type": "text", "text": DISEASE_PROMPT},
                ],
            }]

        raw = await call_openrouter(messages, model=VISION_MODEL)
        result = json.loads(clean_json(raw))

        if db is not None and user_id and patient_name:
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
            logger.info(f"Disease saved for {patient_name}")

        return result

    except HTTPException:
        raise
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e}")
        raise HTTPException(status_code=500, detail=f"AI returned invalid format: {str(e)[:100]}")
    except Exception as e:
        logger.error(f"Disease analysis error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to analyze document: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

# ============================================================
# HABIT / SCREEN TIME
# ============================================================
@app.post("/log-habit")
async def log_habit(session: HabitSession):
    if db is None:
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
    if db is None:
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
# SAVE VITALS
# ============================================================
@app.post("/save-vitals")
async def save_vitals(input: VitalsInput):
    if db is None:
        raise HTTPException(status_code=503, detail="Database not configured.")
    await upsert_patient(input.user_id, input.patient_name)
    await db.patients.update_one(
        {"user_id": input.user_id},
        {"$set": {"vitals": input.vitals, "last_active": datetime.now(timezone.utc).isoformat()}}
    )
    return {"status": "saved"}

# ============================================================
# PATIENT MANAGEMENT
# ============================================================
@app.get("/patients")
async def get_all_patients():
    if db is None:
        raise HTTPException(status_code=503, detail="Database not configured.")
    cursor = db.patients.find().sort("last_active", -1)
    patients = []
    async for doc in cursor:
        patients.append(serialize(doc))
    return patients

@app.get("/patient/{user_id}")
async def get_patient(user_id: str):
    if db is None:
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
    if db is None:
        raise HTTPException(status_code=503, detail="Database not configured.")

    patient = await db.patients.find_one({"user_id": user_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")

    vitals = patient.get("vitals", {})
    vitals_str = ""
    if vitals:
        vitals_str = f"Age: {vitals.get('age', 'N/A')} yrs, Height: {vitals.get('height_cm', 'N/A')} cm, Weight: {vitals.get('weight_kg', 'N/A')} kg, Gender: {vitals.get('gender', 'N/A')}, BMI: {vitals.get('bmi', 'N/A')}"

    food_logs    = [d async for d in db.food_logs.find({"user_id": user_id}).sort("timestamp", -1).limit(10)]
    disease_logs = [d async for d in db.disease_logs.find({"user_id": user_id}).sort("timestamp", -1).limit(10)]
    habit_logs   = [d async for d in db.habit_logs.find({"user_id": user_id}).sort("logged_at", -1).limit(10)]

    prompt = f"""You are a health AI generating a Digital Twin health report.

Patient: {patient.get('patient_name', 'Unknown')}
Vitals: {vitals_str or 'No vitals recorded yet.'}

Recent Food Logs:
{chr(10).join([d.get('summary','') for d in food_logs]) or 'No food data yet.'}

Recent Disease/Condition Logs:
{chr(10).join([d.get('summary','') for d in disease_logs]) or 'No disease data yet.'}

Recent Habit/Screen Time Logs:
{chr(10).join([d.get('summary','') for d in habit_logs]) or 'No habit data yet.'}

Write a health summary in exactly 3 paragraphs:
1. Overall health status based on food and nutrition patterns (and how it relates to their vitals/BMI if recorded)
2. Health conditions and risks identified (incorporating their age, gender, and BMI details if available)
3. Lifestyle and habit assessment with actionable recommendations

Be warm, encouraging, and constructive. Use plain English."""

    try:
        messages = [{"role": "user", "content": prompt}]
        summary = await call_openrouter(messages, model=TEXT_MODEL)
    except Exception as e:
        logger.error(f"Failed to generate AI summary: {e}")
        summary = "AI Health Summary is temporarily unavailable. Please verify your OpenRouter API key configuration in .env."

    return {
        "patient_name":    patient.get("patient_name"),
        "ai_summary":      summary,
        "food_count":      patient.get("food_count", 0),
        "disease_count":   patient.get("disease_count", 0),
        "habit_count":     patient.get("habit_count", 0),
        "last_active":     patient.get("last_active"),
        "vitals":          vitals,
        "recent_food":     [serialize(d) for d in food_logs],
        "recent_diseases": [serialize(d) for d in disease_logs],
        "recent_habits":   [serialize(d) for d in habit_logs],
    }

# ============================================================
# SMART RECOMMENDATIONS & TREATMENT WAYS (DIGITAL TWIN ENGINE)
# ============================================================
import urllib.parse

@app.get("/recommendations/{user_id}")
async def get_recommendations(user_id: str):
    if db is None:
        raise HTTPException(status_code=503, detail="Database not configured.")

    patient = await db.patients.find_one({"user_id": user_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")

    # Accumulate ALL Digital Twin data streams (Vitals, Food Logs, Habit Logs, Disease/Reports)
    vitals = patient.get("vitals", {})
    food_logs    = [d async for d in db.food_logs.find({"user_id": user_id}).sort("timestamp", -1).limit(10)]
    habit_logs   = [d async for d in db.habit_logs.find({"user_id": user_id}).sort("logged_at", -1).limit(10)]
    disease_logs = [d async for d in db.disease_logs.find({"user_id": user_id}).sort("timestamp", -1).limit(10)]

    # Check if user has ANY health data in their digital twin
    if not vitals and not food_logs and not habit_logs and not disease_logs:
        raise HTTPException(
            status_code=404,
            detail="No health records found yet. Log meals, habits, vitals, or upload medical reports to generate personalized Digital Twin recommendations."
        )

    # 1. Summarize Vitals & Demographics
    vitals_parts = []
    if vitals.get("age"): vitals_parts.append(f"Age: {vitals.get('age')} yrs")
    if vitals.get("gender"): vitals_parts.append(f"Gender: {vitals.get('gender')}")
    if vitals.get("bmi"): vitals_parts.append(f"BMI: {vitals.get('bmi')}")
    if vitals.get("weight_kg"): vitals_parts.append(f"Weight: {vitals.get('weight_kg')} kg")
    if vitals.get("height_cm"): vitals_parts.append(f"Height: {vitals.get('height_cm')} cm")
    vitals_str = ", ".join(vitals_parts) if vitals_parts else "Not recorded"

    # 2. Summarize Food & Nutrition Logs
    food_summaries = []
    for d in food_logs:
        fname = d.get("food_name") or "Meal"
        cals = d.get("calories", "")
        verd = d.get("verdict", "")
        food_summaries.append(f"- {fname} ({cals} kcal): {verd}")
    food_text = "\n".join(food_summaries) if food_summaries else "No food logs recorded yet."

    # 3. Summarize Lifestyle & Habit Logs
    habit_summaries = []
    for d in habit_logs:
        act = d.get("active_minutes", 0)
        idle = d.get("idle_minutes", 0)
        sess = d.get("sessions", 1)
        habit_summaries.append(f"- Active: {act:.0f}m, Screen/Idle: {idle:.0f}m ({sess} sessions)")
    habit_text = "\n".join(habit_summaries) if habit_summaries else "No habit/screen time logs recorded yet."

    # 4. Summarize Clinical Reports & Disease Scans
    detailed_reports = []
    source_reports = []
    for i, d in enumerate(disease_logs):
        full = d.get("full_result") or {}
        cond = d.get("condition_name") or full.get("condition_name", "Clinical Finding")
        sev = d.get("severity") or full.get("severity", "Moderate")
        date_str = (d.get("timestamp") or "")[:10]
        desc = full.get("brief_description") or d.get("summary", "")
        rep_sum = full.get("report_summary", "")
        treatments = ", ".join(full.get("treatments", [])[:5])
        causes = ", ".join(full.get("causes", [])[:5])
        risks = ", ".join(full.get("risks", [])[:5])

        source_reports.append({
            "condition_name": cond,
            "severity": sev,
            "date": date_str,
            "summary": desc[:180] + ("..." if len(desc) > 180 else ""),
        })

        chunk = f"--- Clinical Scan {i+1} ({date_str}) ---\nCondition/Diagnosis: {cond}\nSeverity: {sev}\n"
        if desc: chunk += f"Overview: {desc}\n"
        if rep_sum: chunk += f"Clinical & Lab Findings: {rep_sum[:800]}\n"
        if treatments: chunk += f"Identified Treatments: {treatments}\n"
        if causes: chunk += f"Causes: {causes}\n"
        if risks: chunk += f"Risks: {risks}\n"
        detailed_reports.append(chunk)

    conditions_summary = "\n\n".join(detailed_reports) if detailed_reports else "No clinical pathology reports or disease scans logged yet."

    prompt = f"""You are Medule's Senior Clinical Pharmacologist, Digital Twin Health Intelligence Engine, and Lifestyle Medical Director.
You think like the Digital Twin engine: synthesize ALL patient data streams—vitals/BMI, nutrition & food logs, daily habits/screen time, and pathology lab reports/disease scans.

=== PATIENT DIGITAL TWIN HEALTH PROFILE ===
Patient Name: {patient.get('patient_name', 'Patient')}
Vitals & Demographics: {vitals_str}

Recent Nutrition & Food Logs:
{food_text}

Recent Lifestyle & Habit Logs (Screen Time / Sedentary Activity):
{habit_text}

Clinical Reports & Disease Recognition Scans:
{conditions_summary}
==========================================

Provide a comprehensive, highly personalized treatment and healthcare product guidance plan.
CRITICAL REQUIREMENTS FOR PRODUCTS & AFFILIATE COMMERCE:
1. Every recommendation item MUST name an ACTUAL, REAL-WORLD commercial product or item with brand name and model (e.g. "Omron Platinum Wireless Blood Pressure Monitor", "Nature Made Vitamin D3 2000 IU Softgels", "CeraVe SA Cream for Rough & Bumpy Skin", "Accu-Chek Guide Me Blood Glucose Meter", "TheraTears Dry Eye Therapy Lubricant Drops", "Optimum Nutrition Gold Standard 100% Whey", "Bausch + Lomb PreserVision AREDS 2 Eye Vitamins", "Twinings Pure Peppermint Organic Tea", "TheraBand Professional Non-Latex Resistance Bands", "Philips Sonicare 4100 Electric Toothbrush").
2. Clearly indicate which Digital Twin stream this item targets (e.g., "Screen Time & Eye Fatigue", "Elevated HbA1c Lab Report", "Low Protein / Micronutrient Gap In Food Logs", "Vitals & BMI Optimization").
3. Assign a realistic estimated price range (e.g., "$18 - $28" or "₹499 - ₹899").
4. Specify a trusted store partner (e.g., "Amazon Health", "Tata 1mg", "Apollo Pharmacy", "iHerb").
5. Provide a partner affiliate badge (e.g., "Amazon Choice", "Clinically Validated", "Verified Partner", "Top Rated").

You MUST return ONLY a valid JSON object with NO markdown, NO backticks, and NO code fences.

Exact JSON structure:
{{
  "overall_summary": "A warm, empathetic 3-4 sentence clinical summary synthesizing their complete digital twin (vitals, diet, habits, and clinical reports) and explaining how this recommendation roadmap supports their health.",
  "data_sources_analyzed": {{
    "vitals_summary": "{vitals_str}",
    "food_count": {len(food_logs)},
    "habit_count": {len(habit_logs)},
    "disease_count": {len(disease_logs)}
  }},
  "recommendations": [
    {{
      "category": "Health Products & Medical Devices",
      "items": [
        {{
          "name": "Actual commercial product name with brand (e.g. Omron Platinum Blood Pressure Monitor)",
          "brand": "Brand name (e.g. Omron)",
          "target_source": "Vitals & Blood Pressure Tracking",
          "reason": "Why this specific device helps based on their Digital Twin data.",
          "priority": "High",
          "estimated_price": "$45 - $65",
          "affiliate_store": "Amazon Health",
          "affiliate_badge": "Clinically Validated",
          "instructions": "Practical guidelines on how and when to use."
        }}
      ]
    }},
    {{
      "category": "Medicines & OTC Treatments",
      "items": [
        {{
          "name": "Actual OTC medication or safe topical relief (e.g. Voltaren Arthritis Pain Relief Gel 100g)",
          "brand": "Brand name (e.g. Voltaren)",
          "target_source": "Clinical Reports & Musculoskeletal Findings",
          "reason": "Why this OTC medication relieves symptoms identified in their scan or logs.",
          "priority": "High",
          "estimated_price": "$12 - $18",
          "affiliate_store": "Tata 1mg / Apollo",
          "affiliate_badge": "Verified OTC",
          "instructions": "Recommended dosage, application instructions, and precautions."
        }}
      ]
    }},
    {{
      "category": "Supplements & Nutrients",
      "items": [
        {{
          "name": "Actual brand supplement (e.g. Nature Made Vitamin D3 2000 IU Softgels)",
          "brand": "Brand name (e.g. Nature Made)",
          "target_source": "Food Deficiencies & Blood Lab Markers",
          "reason": "Tied directly to their nutritional gaps or lab deficiency.",
          "priority": "Medium",
          "estimated_price": "$14 - $22",
          "affiliate_store": "Amazon Health",
          "affiliate_badge": "Amazon Choice",
          "instructions": "Optimal timing (e.g. take with breakfast fat) and duration."
        }}
      ]
    }},
    {{
      "category": "Nutrition & Natural Superfoods",
      "items": [
        {{
          "name": "Specific wholesome natural remedy or functional food (e.g. Organic Matcha Green Tea Powder / Rolled Oats)",
          "brand": "Brand name or pure source",
          "target_source": "Dietary Macro Balancing & Gut Health",
          "reason": "Addresses dietary gaps or metabolic optimization from food logs.",
          "priority": "Medium",
          "estimated_price": "$9 - $15",
          "affiliate_store": "Amazon Health",
          "affiliate_badge": "100% Natural",
          "instructions": "Preparation and daily serving suggestions."
        }}
      ]
    }},
    {{
      "category": "Care Pathway & Daily Routine",
      "items": [
        {{
          "name": "Specific action step, ergonomic tool, or clinical milestone",
          "brand": "Medule Care Protocol",
          "target_source": "High Screen Time & Sedentary Habit Logs",
          "reason": "Long-term health preservation and risk reduction.",
          "priority": "High",
          "estimated_price": "Free / Lifestyle",
          "affiliate_store": "Medule Wellness",
          "affiliate_badge": "Core Habit",
          "instructions": "Recommended daily frequency or milestone schedule."
        }}
      ]
    }}
  ]
}}

CRITICAL RULES:
- Include 2-3 items in EACH category.
- Priority MUST be exactly one of: "High", "Medium", "Low".
- Real brand names for products, supplements, and OTC treatments are mandatory.
- Do NOT prescribe controlled or dangerous prescription drugs. Focus on OTC therapies, supportive wellness products, supplements, and lifestyle habits.
- Ground every item in their Digital Twin data (vitals, diet, habits, or reports)."""

    try:
        messages = [{"role": "user", "content": prompt}]
        raw = await call_openrouter(messages, model=TEXT_MODEL)
        result = json.loads(clean_json(raw))

        # Guarantee high-quality affiliate links for every recommendation item
        for cat in result.get("recommendations", []):
            for item in cat.get("items", []):
                prod_name = item.get("name", "")
                store = item.get("affiliate_store", "Amazon Health")
                query = urllib.parse.quote_plus(prod_name)
                if "1mg" in store.lower() or "apollo" in store.lower():
                    item["affiliate_link"] = f"https://www.1mg.com/search/all?name={query}&utm_source=medule_affiliate"
                elif "wellness" in store.lower():
                    item["affiliate_link"] = f"https://www.amazon.com/s?k={query}&tag=medule-21"
                else:
                    item["affiliate_link"] = f"https://www.amazon.com/s?k={query}&tag=medule-21"

        result["source_reports"] = source_reports
        result["recent_food"] = [d.get("summary", "") for d in food_logs[:5]]
        result["recent_habits"] = [d.get("summary", "") for d in habit_logs[:5]]
        result["vitals"] = vitals
        return result
    except json.JSONDecodeError as e:
        logger.error(f"Recommendations JSON parse error: {e}")
        raise HTTPException(status_code=500, detail="AI returned invalid recommendations format.")
    except Exception as e:
        logger.error(f"Recommendations generation error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate recommendations.")

