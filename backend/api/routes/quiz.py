from fastapi import APIRouter, HTTPException, Depends
from models.schemas import QuizRequest, QuizResponse
from services.quiz_service import QuizService
from api.routes.stats import log_activity
from api.routes.auth import get_authenticated_user
from models.auth_models import User
from pydantic import BaseModel
import traceback

router = APIRouter()
quiz_service = QuizService()

class AuthenticatedQuizRequest(BaseModel):
    """Quiz request without user_id (taken from authentication)"""
    course_id: str
    num_questions: int = 5
    difficulty: str = "medium"
    quiz_type: str = "multiple_choice"

@router.post("/generate", response_model=QuizResponse)
async def generate_quiz(
    request: AuthenticatedQuizRequest,
    current_user: User = Depends(get_authenticated_user)
):
    """Generate quiz from study materials"""
    try:
        user_id = str(current_user.id)
        
        questions = quiz_service.generate_quiz(
            user_id,
            request.course_id,
            request.num_questions,
            request.difficulty,
            request.quiz_type
        )
        
        # Log quiz generation
        log_activity(user_id, "quiz", {})
        
        return QuizResponse(questions=questions)
    
    except Exception as e:
        print(f"Error in generate_quiz: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(500, f"Error generating quiz: {str(e)}")
