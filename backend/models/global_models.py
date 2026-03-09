"""
Global models loaded once at startup for performance.
This ensures embeddings and LLM are not recreated on every request.
"""

from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.llms import Ollama
from config import settings
import logging

logger = logging.getLogger(__name__)

# Global instances (loaded once)
_embeddings = None
_llm = None

def get_embeddings():
    """
    Get or create the global embeddings model.
    Uses Sentence Transformers all-MiniLM-L6-v2 (lightweight and fast).
    """
    global _embeddings
    
    if _embeddings is None:
        logger.info(f"Loading embeddings model: {settings.EMBEDDING_MODEL}")
        _embeddings = HuggingFaceEmbeddings(
            model_name=settings.EMBEDDING_MODEL,
            model_kwargs={'device': 'cpu'},  # Use CPU for compatibility
            encode_kwargs={'normalize_embeddings': True}  # Better for similarity search
        )
        logger.info("Embeddings model loaded successfully")
    
    return _embeddings

def get_llm():
    """
    Get or create the global LLM instance.
    Uses Ollama with Llama 3 running locally.
    """
    global _llm
    
    if _llm is None:
        logger.info(f"Connecting to Ollama at {settings.OLLAMA_BASE_URL}")
        _llm = Ollama(
            base_url=settings.OLLAMA_BASE_URL,
            model=settings.OLLAMA_MODEL,
            temperature=settings.LLM_TEMPERATURE
        )
        logger.info(f"LLM connected: {settings.OLLAMA_MODEL}")
    
    return _llm

def preload_models():
    """
    Preload both models at startup for faster first request.
    Call this in main.py on startup.
    """
    logger.info("Preloading models...")
    get_embeddings()
    get_llm()
    logger.info("Models preloaded successfully")
