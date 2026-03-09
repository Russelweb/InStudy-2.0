from config import settings
from services.document_processor import DocumentProcessor
from models.global_models import get_llm
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class SummaryService:
    """
    Summary generation service using local Llama 3.
    Optimized for speed and quality.
    """
    
    def __init__(self):
        # Use global LLM instance
        self.llm = get_llm()
        self.doc_processor = DocumentProcessor()
    
    def generate_summary(self, user_id: str, course_id: str, 
                        document_name: Optional[str], style: str):
        """Generate summary of documents using local LLM"""
        logger.info(f"Generating {style} summary")
        
        vector_store = self.doc_processor.get_vector_store(user_id, course_id)
        
        if not vector_store:
            raise ValueError("No documents found. Please upload study materials first.")
        
        # Get documents (optimized retrieval)
        if document_name:
            docs = vector_store.similarity_search(
                "", 
                k=50,
                filter={"document_name": document_name}
            )
        else:
            docs = vector_store.similarity_search("", k=50)
        
        content = "\n\n".join([doc.page_content for doc in docs[:20]])
        
        style_prompts = {
            "short": "Create a concise 3-5 sentence summary of the key points.",
            "bullet": "Create a bullet-point summary with main topics and subtopics.",
            "detailed": "Create a comprehensive summary covering all major concepts in detail.",
            "exam": "Create an exam revision summary focusing on testable concepts and key facts."
        }
        
        prompt = f"""Study Material:
{content}

{style_prompts.get(style, style_prompts['short'])}"""
        
        logger.info("Generating summary with LLM...")
        response = self.llm.invoke(prompt)
        logger.info("Summary generated successfully")
        
        return response
