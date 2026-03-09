from pydantic_settings import BaseSettings
from typing import Optional
import os
from pathlib import Path

class Settings(BaseSettings):
    # Ollama Configuration
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3"
    
    # Embedding Model
    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    
    # Optional Firebase (not required for core functionality)
    FIREBASE_PROJECT_ID: Optional[str] = None
    FIREBASE_PRIVATE_KEY: Optional[str] = None
    FIREBASE_CLIENT_EMAIL: Optional[str] = None
    
    # Storage
    UPLOAD_DIR: str = "uploads"
    VECTOR_STORE_DIR: str = "vector_store"
    
    # RAG Configuration
    CHUNK_SIZE: int = 500
    CHUNK_OVERLAP: int = 50
    TOP_K_RETRIEVAL: int = 3
    SIMILARITY_THRESHOLD: float = 0.7
    
    # LLM Configuration
    LLM_TEMPERATURE: float = 0.2
    
    class Config:
        env_file = ".env"
        extra = "ignore"

# Initialize settings
try:
    settings = Settings()
except Exception as e:
    print(f"Warning: Could not load settings from .env: {e}")
    settings = Settings()

# Create directories
base_dir = Path(__file__).parent
upload_dir = base_dir / settings.UPLOAD_DIR
vector_store_dir = base_dir / settings.VECTOR_STORE_DIR

upload_dir.mkdir(exist_ok=True)
vector_store_dir.mkdir(exist_ok=True)
