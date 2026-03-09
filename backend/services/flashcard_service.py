from config import settings
from services.document_processor import DocumentProcessor
from models.global_models import get_llm
import json
import logging

logger = logging.getLogger(__name__)


class FlashcardService:
    """
    Flashcard generation service using local Llama 3.
    Optimized for speed and quality.
    """
    
    def __init__(self):
        # Use global LLM instance
        self.llm = get_llm()
        self.doc_processor = DocumentProcessor()
    
    def generate_flashcards(self, user_id: str, course_id: str, num_cards: int):
        """Generate flashcards from study materials using local LLM"""
        logger.info(f"Generating {num_cards} flashcards")
        
        vector_store = self.doc_processor.get_vector_store(user_id, course_id)
        
        if not vector_store:
            raise ValueError("No documents found for this course. Please upload study materials first.")
        
        # Get content samples (optimized retrieval)
        docs = vector_store.similarity_search("", k=min(15, num_cards * 2))
        context = "\n\n".join([doc.page_content for doc in docs[:8]])
        
        prompt = f"""You are generating flashcards for a student. Create exactly {num_cards} flashcards.

Study Material:
{context}

CRITICAL: Return ONLY a JSON object, nothing else. No explanations, no markdown, just the JSON.

Format:
{{"flashcards": [{{"front": "Question or concept", "back": "Answer or explanation"}}]}}

Generate {num_cards} flashcards now:"""
        
        logger.info("Generating flashcards with LLM...")
        response = self.llm.invoke(prompt)
        
        try:
            # Extract JSON from response (handle extra text)
            response_text = response.strip()
            
            # Remove markdown code blocks
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0]
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0]
            
            # Find JSON object boundaries
            start_idx = response_text.find("{")
            end_idx = response_text.rfind("}")
            
            if start_idx != -1 and end_idx != -1:
                response_text = response_text[start_idx:end_idx+1]
            
            response_text = response_text.strip()
            
            # Try to parse
            result = json.loads(response_text)
            
            if "flashcards" in result and isinstance(result["flashcards"], list):
                logger.info(f"Successfully generated {len(result['flashcards'])} flashcards")
                return result["flashcards"]
            else:
                logger.error("Response missing 'flashcards' key or not a list")
                return self._parse_flashcards_fallback(num_cards)
                
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse flashcard JSON: {e}")
            logger.error(f"Response was: {response[:500]}")
            # Try to extract flashcards manually
            return self._extract_flashcards_from_text(response, num_cards)
        except Exception as e:
            logger.error(f"Unexpected error parsing flashcards: {e}")
            return self._parse_flashcards_fallback(num_cards)
    
    def _extract_flashcards_from_text(self, text: str, num_cards: int):
        """Try to extract flashcards from malformed JSON"""
        logger.warning("Attempting to extract flashcards from text")
        
        flashcards = []
        
        # Look for "front" and "back" patterns
        import re
        front_pattern = r'"front":\s*"([^"]+)"'
        back_pattern = r'"back":\s*"([^"]+)"'
        
        fronts = re.findall(front_pattern, text)
        backs = re.findall(back_pattern, text)
        
        # Pair them up
        for i in range(min(len(fronts), len(backs))):
            flashcards.append({
                "front": fronts[i],
                "back": backs[i]
            })
        
        if flashcards:
            logger.info(f"Extracted {len(flashcards)} flashcards from text")
            return flashcards
        
        return self._parse_flashcards_fallback(num_cards)
    
    def _parse_flashcards_fallback(self, num_cards: int):
        """Fallback if JSON parsing fails"""
        logger.warning("Using fallback flashcard generation")
        return [{
            "front": f"Concept {i+1} from your study material",
            "back": f"Explanation {i+1} - Please try generating again for better results."
        } for i in range(num_cards)]
