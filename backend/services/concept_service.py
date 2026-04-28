"""
Concept extraction service using local LLM.
Identifies key topics/concepts from study materials to enable adaptive learning.
"""

from models.global_models import get_llm
from database.mastery_db import mastery_db
from utils.concept_utils import normalize_concepts, extract_concept_from_text
import json
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

class ConceptService:
    def __init__(self):
        pass
    
    def extract_concepts_from_text(self, text: str, api_key: Optional[str] = None) -> List[str]:
        """Ask the LLM to identify the main concepts in a block of text"""
        # Get appropriate LLM
        llm = get_llm(api_key)
        prompt = f"""
        Identify the 1-3 most important core concepts discussed in this text.
        Text: {text[:2000]}
        
        Respond with ONLY a comma-separated list of short concept names (e.g., 'Backpropagation, Calculus, Neural Networks').
        Do not include any other explanations.
        """
        try:
            response = llm.invoke(prompt)
            # Extract text content (handles both strings from Ollama and objects from Groq)
            response_text = response if isinstance(response, str) else getattr(response, 'content', str(response))
            # Clean and split into a list
            concepts = [c.strip() for c in response_text.split(",")]
            
            # Normalize all concepts
            normalized = normalize_concepts(concepts)
            
            # If LLM extraction failed or returned nothing valid, use fallback
            if not normalized:
                logger.warning("LLM concept extraction failed, using fallback heuristics")
                normalized = extract_concept_from_text(text, max_concepts=3)
            
            logger.info(f"Extracted concepts: {normalized}")
            return normalized
        except Exception as e:
            logger.error(f"Error extracting concepts: {e}")
            # Fallback to heuristic extraction
            return extract_concept_from_text(text, max_concepts=3)

    def get_summary_context_for_mastery(self, user_id: str, course_id: str) -> str:
        """Construct a context string for the LLM based on user's current mastery profile"""
        profile = mastery_db.get_user_mastery(user_id, course_id)
        if not profile:
            return ""
        
        unfamiliar = [p['concept_id'] for p in profile if p['familiarity_score'] < 0]
        mastered = [p['concept_id'] for p in profile if p['familiarity_score'] > 0]
        
        context = "ADAPTIVE LEARNING PROFILE:\n"
        if unfamiliar:
            context += f"- USER IS WEAK IN (Expand these): {', '.join(unfamiliar[:10])}\n"
        if mastered:
            context += f"- USER HAS MASTERED (Keep these concise): {', '.join(mastered[:10])}\n"
            
        return context

# Global instance
concept_service = ConceptService()
