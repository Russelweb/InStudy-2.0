from fastapi import APIRouter, HTTPException, Depends, Request
from models.schemas import FlashcardRequest, FlashcardResponse
from services.flashcard_service import FlashcardService
from api.routes.auth import get_authenticated_user
from models.auth_models import User
from pydantic import BaseModel
import traceback
from typing import Optional

router = APIRouter()
flashcard_service = FlashcardService()

class AuthenticatedFlashcardRequest(BaseModel):
    """Flashcard request without user_id (taken from authentication)"""
    course_id: str
    num_cards: int = 10
    include_images: bool = True  # New option for images
    explanation_level: str = "detailed"  # New option for explanation detail level
    filename: Optional[str] = None  # Specific document focus

@router.post("/generate", response_model=FlashcardResponse)
async def generate_flashcards(
    request: Request,
    payload: AuthenticatedFlashcardRequest,
    current_user: User = Depends(get_authenticated_user)
):
    """Generate flashcards from study materials"""
    try:
        user_id = str(current_user.id)
        api_key = getattr(request.state, "groq_api_key", None)
        
        flashcards = flashcard_service.generate_flashcards(
            user_id,
            payload.course_id,
            payload.num_cards,
            payload.include_images,
            payload.explanation_level,
            payload.filename,
            api_key=api_key
        )
        
        return FlashcardResponse(flashcards=flashcards)
    
    except ValueError as e:
        if "NO_DOCUMENTS" in str(e):
            raise HTTPException(400, "No documents uploaded yet. Go to Knowledge Base and upload a document to this course first.")
        raise HTTPException(400, str(e))
    except Exception as e:
        print(f"Error in generate_flashcards: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(500, f"Error generating flashcards: {str(e)}")
