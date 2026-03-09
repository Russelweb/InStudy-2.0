from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
from dotenv import load_dotenv
import logging

from api.routes import documents, chat, quiz, flashcards, summary, planner
from services.auth_service import verify_token
from models.global_models import preload_models

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

load_dotenv()

app = FastAPI(title="InStudy 2.0 API", version="2.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
app.include_router(documents.router, prefix="/api/documents", tags=["documents"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(quiz.router, prefix="/api/quiz", tags=["quiz"])
app.include_router(flashcards.router, prefix="/api/flashcards", tags=["flashcards"])
app.include_router(summary.router, prefix="/api/summary", tags=["summary"])
app.include_router(planner.router, prefix="/api/planner", tags=["planner"])

@app.get("/")
async def root():
    return {
        "message": "InStudy 2.0 API - Local Edition",
        "status": "running",
        "models": {
            "embeddings": "sentence-transformers/all-MiniLM-L6-v2",
            "llm": "llama3 (via Ollama)"
        }
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "embeddings": "local",
        "llm": "local"
    }
