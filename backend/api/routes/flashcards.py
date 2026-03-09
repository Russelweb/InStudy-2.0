from fastapi import APIRouter, HTTPException
from models.schemas import FlashcardRequest, FlashcardResponse
from services.flashcard_service import FlashcardService
import traceback

router = APIRouter()
flashcard_service = FlashcardService()

@router.post("/generate", response_model=FlashcardResponse)
async def generate_flashcards(request: FlashcardRequest):
    """Generate flashcards from study materials"""
    try:
        flashcards = flashcard_service.generate_flashcards(
            request.user_id,
            request.course_id,
            request.num_cards
        )
        
        return FlashcardResponse(flashcards=flashcards)
    
    except Exception as e:
        print(f"Error in generate_flashcards: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(500, f"Error generating flashcards: {str(e)}")
