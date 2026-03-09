from fastapi import APIRouter, HTTPException
from models.schemas import QuizRequest, QuizResponse
from services.quiz_service import QuizService
import traceback

router = APIRouter()
quiz_service = QuizService()

@router.post("/generate", response_model=QuizResponse)
async def generate_quiz(request: QuizRequest):
    """Generate quiz from study materials"""
    try:
        questions = quiz_service.generate_quiz(
            request.user_id,
            request.course_id,
            request.num_questions,
            request.difficulty,
            request.quiz_type
        )
        
        return QuizResponse(questions=questions)
    
    except Exception as e:
        print(f"Error in generate_quiz: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(500, f"Error generating quiz: {str(e)}")
