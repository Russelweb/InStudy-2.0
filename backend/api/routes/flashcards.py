from fastapi import APIRouter, HTTPException, Depends
from models.schemas import FlashcardRequest, FlashcardResponse
from services.flashcard_service import FlashcardService
from api.routes.auth import get_authenticated_user
from models.auth_models import User
from pydantic import BaseModel
import traceback

router = APIRouter()
flashcard_service = FlashcardService()

class AuthenticatedFlashcardRequest(BaseModel):
    """Flashcard request without user_id (taken from authentication)"""
    course_id: str
    num_cards: int = 10

@router.post("/generate", response_model=FlashcardResponse)
async def generate_flashcards(
    request: AuthenticatedFlashcardRequest,
    current_user: User = Depends(get_authenticated_user)
):
    """Generate flashcards from study materials"""
    try:
        user_id = str(current_user.id)
        
        flashcards = flashcard_service.generate_flashcards(
            user_id,
            request.course_id,
            request.num_cards
        )
        
        return FlashcardResponse(flashcards=flashcards)
    
    except Exception as e:
        print(f"Error in generate_flashcards: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(500, f"Error generating flashcards: {str(e)}")
