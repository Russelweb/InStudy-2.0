"""
Global models loaded once at startup for performance.
This ensures embeddings and LLM are not recreated on every request.
"""

from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.llms import Ollama
from config import settings
import logging
from typing import Optional, Dict

logger = logging.getLogger(__name__)

# Global instances (loaded once)
_embeddings = None
_llm = None
_user_llms = {}  # Cache for user-specific LLM instances

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

def get_llm(api_key: Optional[str] = None):
    """
    Get or create an LLM instance.
    If api_key is provided, creates/returns a user-specific Groq instance.
    Otherwise, fallbacks to global Groq (from settings) or local Ollama.
    """
    global _llm, _user_llms
    
    # CASE 1: User-provided API Key
    if api_key:
        if api_key not in _user_llms:
            try:
                from langchain_groq import ChatGroq
                logger.info("Creating user-specific Groq LLM instance")
                _user_llms[api_key] = ChatGroq(
                    groq_api_key=api_key,
                    model_name=settings.GROQ_MODEL,
                    temperature=settings.LLM_TEMPERATURE
                )
                logger.info("User-specific Groq LLM created successfully")
            except Exception as e:
                logger.error(f"Error creating user Groq LLM: {e}")
                return get_llm(None) # Fallback to default
        return _user_llms[api_key]

    # CASE 2: Global Singleton (if not already created)
    if _llm is None:
        # Check if we should use default Groq from environment
        if settings.GROQ_API_KEY:
            try:
                from langchain_groq import ChatGroq
                logger.info(f"Using Default Groq Cloud LLM: {settings.GROQ_MODEL}")
                _llm = ChatGroq(
                    groq_api_key=settings.GROQ_API_KEY,
                    model_name=settings.GROQ_MODEL,
                    temperature=settings.LLM_TEMPERATURE
                )
                logger.info("Default Groq LLM connected successfully")
            except ImportError:
                logger.warning("langchain-groq not installed. Falling back to local Ollama.")
                _llm = None
            except Exception as e:
                logger.error(f"Error connecting to default Groq: {e}. Falling back to local Ollama.")
                _llm = None
        
        # Fallback to Ollama if Groq failed or wasn't configured
        if _llm is None:
            logger.info(f"Connecting to Ollama at {settings.OLLAMA_BASE_URL}")
            _llm = Ollama(
                base_url=settings.OLLAMA_BASE_URL,
                model=settings.OLLAMA_MODEL,
                temperature=settings.LLM_TEMPERATURE
            )
            logger.info(f"Local LLM connected: {settings.OLLAMA_MODEL}")
    
    return _llm

def preload_models():
    """
    Preload both models at startup for faster first request.
    Call this in main.py on startup.
    """
    logger.info("Preloading models...")
    get_embeddings()
    get_llm() # Preload default LLM
    logger.info("Models preloaded successfully")

def get_model_info(api_key: Optional[str] = None):
    """Get info about current models for UI display"""
    from config import settings
    
    if api_key:
        llm_info = f"Groq (User Key - {settings.GROQ_MODEL})"
        mode = "Cloud (Personal)"
    elif settings.GROQ_API_KEY:
        llm_info = f"Groq (Default - {settings.GROQ_MODEL})"
        mode = "Cloud (Shared)"
    else:
        llm_info = f"Ollama ({settings.OLLAMA_MODEL})"
        mode = "Local"
        
    return {
        "llm": llm_info,
        "embeddings": settings.EMBEDDING_MODEL,
        "mode": mode
    }
