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
_local_llm = None
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

def get_local_llm():
    """Returns a local Ollama instance for fallback."""
    global _local_llm
    if _local_llm is None:
        logger.info(f"Initializing local fallback LLM: {settings.OLLAMA_MODEL}")
        _local_llm = Ollama(
            base_url=settings.OLLAMA_BASE_URL,
            model=settings.OLLAMA_MODEL,
            temperature=settings.LLM_TEMPERATURE
        )
    return _local_llm

class HybridLLM:
    """Wrapper that falls back to local LLM if cloud LLM fails."""
    def __init__(self, cloud_llm, local_llm):
        self.cloud_llm = cloud_llm
        self.local_llm = local_llm
        self.last_used = "cloud"

    def invoke(self, *args, **kwargs):
        try:
            res = self.cloud_llm.invoke(*args, **kwargs)
            self.last_used = "cloud"
            return res
        except Exception as e:
            logger.error(f"Cloud LLM error: {e}. Falling back to LOCAL LLM.")
            self.last_used = "local"
            return self.local_llm.invoke(*args, **kwargs)

    async def ainvoke(self, *args, **kwargs):
        try:
            res = await self.cloud_llm.ainvoke(*args, **kwargs)
            self.last_used = "cloud"
            return res
        except Exception as e:
            logger.error(f"Cloud LLM (Async) error: {e}. Falling back to LOCAL LLM.")
            self.last_used = "local"
            return await self.local_llm.ainvoke(*args, **kwargs)

    def generate(self, *args, **kwargs):
        try:
            res = self.cloud_llm.generate(*args, **kwargs)
            self.last_used = "cloud"
            return res
        except Exception as e:
            logger.error(f"Cloud LLM generate error: {e}. Falling back to LOCAL LLM.")
            self.last_used = "local"
            return self.local_llm.generate(*args, **kwargs)

    def stream(self, *args, **kwargs):
        try:
            yield from self.cloud_llm.stream(*args, **kwargs)
            self.last_used = "cloud"
        except Exception as e:
            logger.error(f"Cloud LLM stream error: {e}. Falling back to LOCAL LLM.")
            self.last_used = "local"
            yield from self.local_llm.stream(*args, **kwargs)

    @property
    def _llm_type(self):
        return "hybrid"

def get_llm(api_key: Optional[str] = None, model_name: Optional[str] = None):
    """
    Get or create an LLM instance.
    If api_key is provided, creates/returns a user-specific Groq instance.
    If model_name is provided, uses that specific model.
    Otherwise, fallbacks to global Groq (from settings) or local Ollama.
    """
    global _llm, _user_llms
    
    target_model = model_name or settings.GROQ_MODEL
    cache_key = f"{api_key}_{target_model}" if api_key else f"default_{target_model}"
    
    # CASE 1: User-provided API Key or Specific Model
    if api_key or model_name:
        if cache_key not in _user_llms:
            try:
                from langchain_groq import ChatGroq
                logger.info(f"Creating specific Groq LLM instance: {target_model}")
                
                # Use provided key or fallback to default
                active_key = api_key or settings.GROQ_API_KEY
                if not active_key:
                    return get_local_llm()

                instance = ChatGroq(
                    groq_api_key=active_key,
                    model_name=target_model,
                    temperature=settings.LLM_TEMPERATURE
                )
                
                # Wrap with local fallback
                _user_llms[cache_key] = HybridLLM(
                    cloud_llm=instance,
                    local_llm=get_local_llm()
                )
                logger.info(f"Specific Groq LLM ({target_model}) created successfully")
            except Exception as e:
                logger.error(f"Error creating specific Groq LLM: {e}")
                return get_local_llm()
                
        return _user_llms[cache_key]

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
            _llm = get_local_llm()
        else:
            # Wrap the global Groq with local fallback
            _llm = HybridLLM(cloud_llm=_llm, local_llm=get_local_llm())
    
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
    
    current_llm = get_llm(api_key)
    is_hybrid = isinstance(current_llm, HybridLLM)
    
    if api_key:
        llm_info = f"Groq (User Key - {settings.GROQ_MODEL})"
        mode = "Cloud (Personal)"
    elif settings.GROQ_API_KEY:
        llm_info = f"Groq (Default - {settings.GROQ_MODEL})"
        mode = "Cloud (Shared)"
    else:
        llm_info = f"Local ({settings.OLLAMA_MODEL})"
        mode = "Local Only"
        
    if is_hybrid:
        mode = f"Hybrid ({mode} -> Local)"
        
    return {
        "llm": llm_info,
        "embeddings": settings.EMBEDDING_MODEL,
        "mode": mode
    }
