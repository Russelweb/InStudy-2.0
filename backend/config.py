from pydantic_settings import BaseSettings
from typing import List, Optional
import os
from pathlib import Path

DEFAULT_ENCRYPTION_KEY = "instudy_secret_key_32_bytes_long_!!"


class Settings(BaseSettings):
    # Runtime
    APP_ENV: str = "development"
    FRONTEND_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Ollama Configuration
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "gemma:2b"

    # Groq Configuration (Optional)
    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: str = "llama-3.1-8b-instant"

    # Embedding Model (Multilingual support for cross-lingual RAG)
    EMBEDDING_MODEL: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

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
    SIMILARITY_THRESHOLD: float = 1.5  # Increased for more lenient matching (lower = more similar)

    # LLM Configuration
    LLM_TEMPERATURE: float = 0.2
    LLM_TIMEOUT: int = 180  # Timeout for LLM requests in seconds
    STREAM_CHUNK_SIZE: int = 1024  # Size of streaming chunks
    
    # Security
    ENCRYPTION_KEY: str = DEFAULT_ENCRYPTION_KEY # Override in production
    BOOTSTRAP_ADMIN_EMAIL: Optional[str] = None
    BOOTSTRAP_ADMIN_PASSWORD: Optional[str] = None

    class Config:
        env_file = ".env"
        extra = "ignore"

    @property
    def is_production(self) -> bool:
        return self.APP_ENV.lower() == "production"

    @property
    def cors_origins(self) -> List[str]:
        return [
            origin.strip()
            for origin in self.FRONTEND_ORIGINS.split(",")
            if origin.strip()
        ]


def validate_security_settings(settings: Settings) -> None:
    if not settings.is_production:
        return

    if settings.ENCRYPTION_KEY == DEFAULT_ENCRYPTION_KEY:
        raise RuntimeError("Set a production ENCRYPTION_KEY before deployment.")

    if len(settings.ENCRYPTION_KEY) < 32:
        raise RuntimeError("ENCRYPTION_KEY must be at least 32 characters.")

    if not settings.cors_origins or "*" in settings.cors_origins:
        raise RuntimeError("Set explicit FRONTEND_ORIGINS before production deployment.")


# Initialize settings
try:
    settings = Settings()
    validate_security_settings(settings)
except Exception as e:
    raise RuntimeError(f"Invalid application settings: {e}") from e

# Create directories
base_dir = Path(__file__).parent
upload_dir = base_dir / settings.UPLOAD_DIR
vector_store_dir = base_dir / settings.VECTOR_STORE_DIR

upload_dir.mkdir(exist_ok=True)
vector_store_dir.mkdir(exist_ok=True)
