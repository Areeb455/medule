import os
import json
import uuid
import logging
import shutil
import asyncio
import base64
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pydantic import BaseModel, Field

import torch
import torch.nn as nn
from PIL import Image
import numpy as np
import pdfplumber
from google import genai
from google.genai import types
from dotenv import load_dotenv

# ============================================================
# CONFIG
# ============================================================
_APP_DIR = Path(__file__).parent

_env_path = _APP_DIR.parent / ".env"
load_dotenv(_env_path if _env_path.exists() else None)

MODEL_PATH       = str(_APP_DIR / "medule_vision_combined_v1.pth")
CLASS_NAMES_PATH = str(_APP_DIR / "class_names.json")
FOOD_DB_PATH     = str(_APP_DIR / "food_database.json")
UPLOAD_DIR       = str(_APP_DIR / "temp_uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GEMINI_MODEL   = os.environ.get("GEMINI_MODEL", "gemini-3-flash-preview")
gemini_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

# ============================================================
# PYDANTIC MODELS
# ============================================================
class Condition(BaseModel):
    name: str = Field(description="Name of the detected medical condition or deficiency")
    description: str = Field(description="Brief explanation of how it impacts dietary needs")

class MedicalProfileResponse(BaseModel):
    conditions: List[Condition] = Field(description="List of detected medical conditions")
    assigned_profile: str = Field(description="One of: full, prediabetic, hypertensive, cardiac, deficiency")
    summary: str = Field(description="A short clinical summary of the patient's status")

# ============================================================
# MEDICAL RULES ENGINE
# ============================================================
MEDICAL_RULES_ENGINE = {
    "LOW_GLYCEMIC_INDEX":  {"type": "RESTRICTION", "conflict_tag": "HIGH_GLYCEMIC_INDEX", "message": "HIGH GLYCEMIC INDEX: Spikes blood sugar — conflicts with prediabetes/HbA1c.", "category": "Blood Sugar"},
    "LOW_ADDED_SUGAR":     {"type": "RESTRICTION", "conflict_tag": "HIGH_SUGAR",          "message": "HIGH SUGAR: Will elevate average glucose levels.",                           "category": "Blood Sugar"},
    "BOOST_FIBER":         {"type": "BOOSTER",     "target_tag":  "HIGH_FIBER",           "message": "HIGH FIBER: Excellent for stabilizing blood sugar.",                        "category": "Blood Sugar"},
    "LOW_SODIUM":          {"type": "RESTRICTION", "conflict_tag": "HIGH_SODIUM",         "message": "HIGH SODIUM: Directly conflicts with elevated blood pressure.",              "category": "Blood Pressure"},
    "BOOST_POTASSIUM":     {"type": "BOOSTER",     "target_tag":  "HIGH_POTASSIUM",       "message": "HIGH POTASSIUM: Helps naturally regulate blood pressure.",                  "category": "Blood Pressure"},
    "LOW_SATURATED_FAT":   {"type": "RESTRICTION", "conflict_tag": "HIGH_SATURATED_FAT",  "message": "HIGH SATURATED FAT: Elevates LDL and worsens cardiovascular risk.",         "category": "Cardiac"},
    "LOW_TRANS_FAT":       {"type": "RESTRICTION", "conflict_tag": "HIGH_TRANS_FAT",      "message": "TRANS FATS: Highly inflammatory — dangerous with arterial plaques.",        "category": "Cardiac"},
    "BOOST_OMEGA_3":       {"type": "BOOSTER",     "target_tag":  "HIGH_OMEGA_3",         "message": "OMEGA-3 RICH: Actively lowers triglycerides.",                             "category": "Cardiac"},
    "BOOST_B12":           {"type": "BOOSTER",     "target_tag":  "HIGH_B12",             "message": "B12 BOOSTER: Recommended to address Vitamin B12 deficiency.",              "category": "Deficiency"},
    "BOOST_VITAMIN_D":     {"type": "BOOSTER",     "target_tag":  "HIGH_VITAMIN_D",       "message": "VITAMIN D: Helps address Vitamin D deficiency.",                           "category": "Deficiency"},
    "BOOST_IRON":          {"type": "BOOSTER",     "target_tag":  "HIGH_IRON",            "message": "IRON RICH: Recommended for low PCV / anaemia.",                            "category": "Deficiency"},
    "BOOST_CALCIUM":       {"type": "BOOSTER",     "target_tag":  "HIGH_CALCIUM",         "message": "CALCIUM RICH: Supports bone density.",                                     "category": "Skeletal"},
    "LOW_CALORIE_DENSITY": {"type": "RESTRICTION", "conflict_tag": "HIGH_CALORIE_DENSITY","message": "HIGH CALORIE DENSITY: Consider a lighter alternative.",                    "category": "Weight"},
}

PATIENT_PROFILES = {
    "full":         list(MEDICAL_RULES_ENGINE.keys()),
    "prediabetic":  ["LOW_GLYCEMIC_INDEX", "LOW_ADDED_SUGAR", "BOOST_FIBER", "LOW_CALORIE_DENSITY"],
    "hypertensive": ["LOW_SODIUM", "BOOST_POTASSIUM", "LOW_CALORIE_DENSITY"],
    "cardiac":      ["LOW_SODIUM", "LOW_SATURATED_FAT", "LOW_TRANS_FAT", "BOOST_OMEGA_3", "BOOST_POTASSIUM", "LOW_CALORIE_DENSITY"],
    "deficiency":   ["BOOST_B12", "BOOST_VITAMIN_D", "BOOST_IRON", "BOOST_CALCIUM"],
}

# ============================================================
# ML STORE & STATE
# ============================================================
ml: Dict[str, Any] = {}
mock_mode = True

# ============================================================
# IMAGE PREPROCESSING
# ============================================================
def _manual_preprocess(img_path: str, device) -> torch.Tensor:
    img = Image.open(img_path).convert("RGB")
    img = img.resize((256, 256), Image.BILINEAR)
    left = top = (256 - 224) // 2
    img = img.crop((left, top, left + 224, top + 224))
    arr = np.array(img, dtype=np.float32) / 255.0
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std  = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    arr  = (arr - mean) / std
    return torch.from_numpy(arr).permute(2, 0, 1).float().unsqueeze(0).to(device)

# ============================================================
# MODEL LOADER
# ============================================================
def _try_load_model() -> bool:
    try:
        from torchvision import models
        device = torch.device("cpu")
        model = models.efficientnet_b0(weights=None)
        model.classifier[1] = nn.Linear(1280, len(ml["class_names"]))
        model.load_state_dict(
            torch.load(MODEL_PATH, map_location=device, weights_only=False)
        )
        model = model.to(device)
        model.eval()
        ml["model"]  = model
        ml["device"] = device
        logger.info(f"EfficientNet B0 loaded — {len(ml['class_names'])} classes")
        return True
    except Exception as e:
        logger.warning(f"Vision model load failed: {e}")
        import traceback
        logger.warning(traceback.format_exc())  # FIX: full traceback so you can debug mock_mode
        return False

# ============================================================
# LIFESPAN
# ============================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    global mock_mode
    logger.info("Starting Medule Vision Engine...")

    ml["device"] = torch.device("cpu")

    try:
        with open(CLASS_NAMES_PATH) as f:
            ml["class_names"] = json.load(f)
        with open(FOOD_DB_PATH) as f:
            ml["food_db"] = json.load(f)
        logger.info(f"Loaded {len(ml['class_names'])} food classes")
    except FileNotFoundError as e:
        logger.warning(f"Data files missing ({e}) — using minimal mock set")
        ml["class_names"] = ["apple", "burger", "salad"]
        ml["food_db"] = {
            "apple":  {"tags": ["HIGH_FIBER", "LOW_CALORIE_DENSITY"]},
            "burger": {"tags": ["HIGH_SATURATED_FAT", "HIGH_SODIUM", "HIGH_CALORIE_DENSITY"]},
            "salad":  {"tags": ["HIGH_FIBER", "HIGH_POTASSIUM"]},
        }

    executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="model_loader")
    try:
        loop = asyncio.get_event_loop()
        loaded = await asyncio.wait_for(
            loop.run_in_executor(executor, _try_load_model),
            timeout=30.0,
        )
        mock_mode = not loaded
    except asyncio.TimeoutError:
        mock_mode = True
        logger.warning("Vision model load timed out (>30 s) — MOCK mode active")
    finally:
        executor.shutdown(wait=False)

    status = "REAL predictions" if not mock_mode else "MOCK predictions (random)"
    logger.info(f"Server ready — {status}")

    yield

    ml.clear()
    logger.info("Server shut down.")


# ============================================================
# APP
# ============================================================
app = FastAPI(
    title="Medule Food Analysis API",
    description="AI-powered clinical food analysis.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# MEDICAL REPORT ENDPOINT — accepts PDF and image
# ============================================================
@app.post("/upload-medical-report", response_model=MedicalProfileResponse)
async def upload_medical_report(file: UploadFile = File(...)):

    # Validate file type
    is_pdf   = file.filename.lower().endswith(".pdf")
    is_image = file.content_type.startswith("image/")

    if not is_pdf and not is_image:
        raise HTTPException(
            status_code=400,
            detail="Please upload a PDF or an image (JPG, PNG, WEBP) of your medical report."
        )

    temp_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}_{file.filename}")

    try:
        with open(temp_path, "wb") as fh:
            shutil.copyfileobj(file.file, fh)

        if not gemini_client:
            logger.warning("No GEMINI_API_KEY — returning mock medical profile.")
            return MedicalProfileResponse(
                conditions=[Condition(
                    name="Elevated Blood Sugar",
                    description="Indicates risk of prediabetes. Needs lower glycemic index foods.",
                )],
                assigned_profile="prediabetic",
                summary="Mock profile: patient shows markers of prediabetes. Set GEMINI_API_KEY for real analysis.",
            )

        http_opts = types.HttpOptions(
            timeout=30000,
            retry_options=types.HttpRetryOptions(
                attempts=5,
                initial_delay=2.0,
                max_delay=60.0,
            )
        )

        PROMPT = """
        You are an expert clinical AI reviewing a medical report uploaded by the user.
        Speak directly to the user in second person — use "you", "your", "you have", "your report shows", etc.
        Never refer to them as "the patient" or in third person.

        Based on their report, identify any diseases, deficiencies, or critical biomarkers that affect their dietary choices.
        Write the summary as if you are personally explaining their results to them.

        Map the user to EXACTLY ONE of these profiles:
        - "prediabetic": high HbA1c, fasting glucose, diabetes markers
        - "hypertensive": high blood pressure, related markers
        - "cardiac": high cholesterol, LDL, triglycerides, cardiovascular risk
        - "deficiency": low Iron, B12, Vitamin D, Calcium, etc.
        - "full": multiple severe categories or none of the specific ones fit
        """

        # ── PDF: extract text and send as text prompt ──
        if is_pdf:
            extracted_text = ""
            with pdfplumber.open(temp_path) as pdf:
                for page in pdf.pages:
                    text = page.extract_text()
                    if text:
                        extracted_text += text + "\n"

            if not extracted_text.strip():
                raise HTTPException(status_code=400, detail="Could not extract text from the PDF. Try uploading an image of the report instead.")

            response = gemini_client.models.generate_content(
                model=GEMINI_MODEL,
                contents=PROMPT + f"\n\nTheir Medical Report:\n{extracted_text[:15000]}",
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=MedicalProfileResponse,
                    temperature=0.1,
                    http_options=http_opts,
                ),
            )

        # ── Image: send directly to Gemini vision ──
        else:
            with open(temp_path, "rb") as img_file:
                img_bytes = img_file.read()

            response = gemini_client.models.generate_content(
                model=GEMINI_MODEL,
                contents=[
                    types.Part.from_bytes(
                        data=img_bytes,
                        mime_type=file.content_type,
                    ),
                    types.Part.from_text(text=PROMPT),
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=MedicalProfileResponse,
                    temperature=0.1,
                    http_options=http_opts,
                ),
            )

        return json.loads(response.text)

    except HTTPException:
        raise
    except Exception as e:
        err_str = str(e)
        logger.error(f"Error processing medical report: {err_str}")
        if "503" in err_str or "UNAVAILABLE" in err_str or "high demand" in err_str.lower():
            raise HTTPException(
                status_code=503,
                detail="The AI service is temporarily overloaded. Please try again in a few seconds.",
            )
        raise HTTPException(status_code=500, detail="Failed to analyze the report. Please try again.")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


# ============================================================
# FOOD ANALYSIS ENDPOINT
# ============================================================
@app.post("/analyze-food")
async def analyze_food(
    image: UploadFile = File(...),
    profile: Optional[str] = Form("full"),
    topk: Optional[int] = Form(3),
):
    if profile not in PATIENT_PROFILES:
        profile = "full"

    allowed = {"image/jpeg", "image/png", "image/webp", "image/bmp"}
    if image.content_type not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type '{image.content_type}'. Upload JPG, PNG, or WEBP.",
        )

    temp_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}_{image.filename}")
    try:
        with open(temp_path, "wb") as fh:
            shutil.copyfileobj(image.file, fh)

        if mock_mode:
            import random
            names = ml["class_names"]
            top_food = random.choice(names)
            other_foods = random.sample(
                [n for n in names if n != top_food],
                min(2, len(names) - 1),
            )
            predictions = [{"food": top_food, "confidence": round(random.uniform(0.75, 0.95), 4)}]
            for food in other_foods:
                predictions.append({"food": food, "confidence": round(random.uniform(0.01, 0.15), 4)})
            predictions.sort(key=lambda x: x["confidence"], reverse=True)
            predictions = predictions[: min(topk, len(predictions))]
        else:
            tensor = _manual_preprocess(temp_path, ml["device"])
            with torch.no_grad():
                outputs = ml["model"](tensor)
                probs   = torch.softmax(outputs, dim=1)
                k = min(topk, len(ml["class_names"]))
                topk_vals, topk_idxs = torch.topk(probs, k=k)
            predictions = [
                {
                    "food":       ml["class_names"][topk_idxs[0][i].item()],
                    "confidence": round(topk_vals[0][i].item(), 4),
                }
                for i in range(k)
            ]

        # ============================================================
        # FIX: Only analyze the TOP prediction for warnings/benefits.
        # Previously iterating all top-k predictions caused duplicate
        # warnings when multiple predictions shared the same food tags.
        # ============================================================
        top = predictions[0]
        user_constraints = PATIENT_PROFILES[profile]
        warnings, benefits = [], []

        food_tags = ml["food_db"].get(top["food"], {}).get("tags", [])
        for constraint in user_constraints:
            rule = MEDICAL_RULES_ENGINE[constraint]
            if rule["type"] == "RESTRICTION" and rule["conflict_tag"] in food_tags:
                # FIX: removed "detected_in" field — it caused identical warnings
                # from different predictions to bypass the dedup check
                entry = {"category": rule["category"], "message": rule["message"]}
                if entry not in warnings:
                    warnings.append(entry)
            elif rule["type"] == "BOOSTER" and rule["target_tag"] in food_tags:
                entry = {"category": rule["category"], "message": rule["message"]}
                if entry not in benefits:
                    benefits.append(entry)

        status = "APPROVED" if not warnings else "NEEDS MODIFICATION"

        return {
            "top_prediction":   top["food"],
            "confidence":       top["confidence"],
            "dietary_status":   status,
            "warnings":         warnings,
            "medical_benefits": benefits,
            "in_database":      top["food"] in ml["food_db"],
            "profile_used":     profile,
            "mock_mode":        mock_mode,
        }

    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


# ============================================================
# HEALTH / INFO ENDPOINTS
# ============================================================
@app.get("/health")
def health():
    return {
        "status":       "ok",
        "mock_mode":    mock_mode,
        "model_loaded": not mock_mode,
        "classes":      len(ml.get("class_names", [])),
        "device":       str(ml.get("device", "not loaded")),
    }


@app.get("/profiles")
def get_profiles():
    return {
        p: {"constraints": c, "count": len(c)}
        for p, c in PATIENT_PROFILES.items()
    }
