import sys
import os

# --- Windows DLL Initialization Fix ---
if sys.platform == 'win32':
    os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
    # Try to import torch as early as possible to claim DLLs
    try:
        import torch
        print(f"Torch pre-loaded: {torch.__version__}")
    except Exception as e:
        print(f"Early torch import failed: {e}")
# --------------------------------------

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv
import logging
from pathlib import Path

from api.routes import documents, chat, quiz, flashcards, summary, planner, stats, auth, admin, mastery, assets
from services.auth_service import verify_token
from models.global_models import preload_models
from middleware.auth_middleware import AuthMiddleware
from config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

load_dotenv()

app = FastAPI(
    title="InStudy 2.0 API",
    version="2.0.0",
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Authentication middleware
app.add_middleware(AuthMiddleware)

# Mount static files
static_dir = Path(__file__).parent / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Startup event to preload models
@app.on_event("startup")
async def startup_event():
    """Preload models at startup for faster first request"""
    logger.info("Starting InStudy 2.0 API...")
    logger.info("Preloading models (this may take a minute)...")
    try:
        preload_models()
        logger.info("✅ Models preloaded successfully!")
        logger.info("✅ InStudy 2.0 API is ready!")
    except Exception as e:
        logger.error(f"❌ Failed to preload models: {e}")
        logger.error("The API will still start, but first requests may be slower.")

# Routes
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(documents.router, prefix="/api/documents", tags=["documents"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(quiz.router, prefix="/api/quiz", tags=["quiz"])
app.include_router(flashcards.router, prefix="/api/flashcards", tags=["flashcards"])
app.include_router(summary.router, prefix="/api/summary", tags=["summary"])
app.include_router(planner.router, prefix="/api/planner", tags=["planner"])
app.include_router(stats.router, prefix="/api/stats", tags=["stats"])
app.include_router(mastery.router, prefix="/api/mastery", tags=["mastery"])
app.include_router(assets.router, prefix="/api/assets", tags=["assets"])

@app.get("/")
async def root():
    from models.global_models import get_model_info
    return {
        "message": "InStudy 2.0 API",
        "status": "online",
        "models": get_model_info()
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "embeddings": "local",
        "llm": "local"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
