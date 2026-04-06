from config import settings
from services.document_processor import DocumentProcessor
from services.image_service import ImageService
from models.global_models import get_llm
from services.concept_service import concept_service
import json
import logging
import asyncio
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)


class FlashcardService:
    """
    Enhanced flashcard generation service with image support.
    Optimized for speed and visual appeal.
    """
    
    def __init__(self):
        # Use global LLM instance
        self.llm = get_llm()
        self.doc_processor = DocumentProcessor()
        self.image_service = ImageService()
        self.executor = ThreadPoolExecutor(max_workers=4)  # For parallel image processing
    
    def generate_flashcards(self, user_id: str, course_id: str, num_cards: int, include_images: bool = True, explanation_level: str = "detailed"):
        """Generate flashcards with optional images from study materials"""
        logger.info(f"Generating {num_cards} flashcards with mastery awareness.")
        
        vector_store = self.doc_processor.get_vector_store(user_id, course_id)
        if not vector_store:
            raise ValueError("No documents found for this course.")
            
        # Get mastery context
        mastery_context = concept_service.get_summary_context_for_mastery(user_id, course_id)
        
        # Target search query towards weak areas if they exist
        search_query = ""
        if "WEAK IN" in mastery_context:
            try:
                search_chunk = mastery_context.split("WEAK IN (Expand these):")[1].split("\n")[0].strip()
                search_query = search_chunk
            except: pass
            
        # Get content samples (prioritizing weak areas via search query)
        docs = vector_store.similarity_search(search_query, k=min(20, num_cards * 3))
        context = "\n\n".join([doc.page_content for doc in docs[:10]])
        
        # Customize prompt based on mastery context
        prompt_prefix = ""
        if mastery_context:
            prompt_prefix = f"USER MASTERY DATA:\n{mastery_context}\nPlease prioritize generating cards for the 'WEAK' concepts while keeping 'MASTERED' points brief.\n\n"
        
        # Customize prompt based on explanation level
        if explanation_level == "brief":
            explanation_instruction = "Make explanations concise but clear (1-2 sentences)"
            example_back = "Photosynthesis is the process by which plants convert sunlight into chemical energy using chlorophyll. This process produces glucose and oxygen, which are essential for life on Earth."
        elif explanation_level == "comprehensive":
            explanation_instruction = "Make explanations very detailed and educational (4-6 sentences with examples, context, and significance)"
            example_back = "Photosynthesis is the fundamental biological process by which plants, algae, and some bacteria convert light energy (usually from the sun) into chemical energy stored in glucose molecules. This complex process occurs in two main stages: the light-dependent reactions in the thylakoids and the light-independent reactions (Calvin cycle) in the stroma of chloroplasts. During photosynthesis, plants absorb carbon dioxide from the atmosphere and water from the soil, using chlorophyll to capture light energy and convert these raw materials into glucose (C₆H₁₂O₆) and oxygen (O₂). This process is absolutely critical for life on Earth because it produces virtually all the oxygen in our atmosphere and forms the foundation of most food chains. The overall equation is: 6CO₂ + 6H₂O + light energy → C₆H₁₂O₆ + 6O₂. Without photosynthesis, complex life as we know it could not exist on our planet."
        else:  # detailed (default)
            explanation_instruction = "Make explanations educational and comprehensive (3-5 sentences with context and examples)"
            example_back = "Photosynthesis is the process by which plants convert sunlight into chemical energy. During this process, plants use chlorophyll to capture light energy and combine carbon dioxide from the air with water from the soil to produce glucose and oxygen. This process is essential for life on Earth as it produces the oxygen we breathe and forms the base of most food chains. The equation is: 6CO₂ + 6H₂O + light energy → C₆H₁₂O₆ + 6O₂."
        
        prompt = f"""{prompt_prefix}You are an expert educator creating study flashcards. Create exactly {num_cards} high-quality flashcards from the study material.

Study Material:
{context}

INSTRUCTIONS:
- Front: Clear, concise question or key concept
- Back: Complete answer with explanation
- Concept: Identify the 1-2 word main topic for this card
- {explanation_instruction}
- Focus on deep understanding

EXAMPLE FORMAT:
Front: "What is photosynthesis?"
Back: "{example_back}"
Concept: "Photosynthesis"

CRITICAL: Return ONLY a JSON object.
{{"flashcards": [{{"front": "Question", "back": "Answer", "concept": "Topic"}}]}}

Generate {num_cards} educational flashcards now:"""
        
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
                flashcards = result["flashcards"]
                logger.info(f"Successfully generated {len(flashcards)} flashcards")
                
                # Add images if requested
                if include_images:
                    flashcards = self._add_images_to_flashcards(flashcards)
                
                return flashcards
            else:
                logger.error("Response missing 'flashcards' key or not a list")
                return self._parse_flashcards_fallback(num_cards, include_images)
                
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse flashcard JSON: {e}")
            logger.error(f"Response was: {response[:500]}")
            # Try to extract flashcards manually
            return self._extract_flashcards_from_text(response, num_cards, include_images)
        except Exception as e:
            logger.error(f"Unexpected error parsing flashcards: {e}")
            return self._parse_flashcards_fallback(num_cards, include_images)
    
    def _add_images_to_flashcards(self, flashcards: list) -> list:
        """Add images to flashcards using parallel processing"""
        logger.info("Adding images to flashcards...")
        
        def add_image_to_card(card):
            """Add image to a single flashcard"""
            try:
                image_data = self.image_service.get_flashcard_image(
                    card.get("front", ""), 
                    card.get("back", "")
                )
                card.update(image_data)
                return card
            except Exception as e:
                logger.warning(f"Failed to add image to card: {e}")
                # Add default image
                card.update({
                    "image_url": "📚",  # Just the emoji
                    "image_type": "emoji",
                    "alt_text": "Study card"
                })
                return card
        
        # Process images in parallel for speed
        try:
            with ThreadPoolExecutor(max_workers=4) as executor:
                enhanced_cards = list(executor.map(add_image_to_card, flashcards))
            
            logger.info(f"Successfully added images to {len(enhanced_cards)} flashcards")
            return enhanced_cards
            
        except Exception as e:
            logger.error(f"Error in parallel image processing: {e}")
            # Fallback to sequential processing
            return [add_image_to_card(card) for card in flashcards]
    
    def _extract_flashcards_from_text(self, text: str, num_cards: int, include_images: bool = True):
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
            if include_images:
                flashcards = self._add_images_to_flashcards(flashcards)
            return flashcards
        
        return self._parse_flashcards_fallback(num_cards, include_images)
    
    def _parse_flashcards_fallback(self, num_cards: int, include_images: bool = True):
        """Fallback if JSON parsing fails"""
        logger.warning("Using fallback flashcard generation")
        
        fallback_cards = [{
            "front": f"Concept {i+1} from your study material",
            "back": f"Explanation {i+1} - Please try generating again for better results."
        } for i in range(num_cards)]
        
        if include_images:
            fallback_cards = self._add_images_to_flashcards(fallback_cards)
        
        return fallback_cards
