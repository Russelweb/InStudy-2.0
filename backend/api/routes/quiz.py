from fastapi import APIRouter, HTTPException, Depends, Request
from models.schemas import QuizRequest, QuizResponse
from services.quiz_service import QuizService
from api.routes.stats import log_activity
from api.routes.auth import get_authenticated_user
from services.auth_service import auth_service
from models.auth_models import User
from pydantic import BaseModel
from typing import Dict, List, Any, Optional
import traceback

router = APIRouter()
quiz_service = QuizService()

class AuthenticatedQuizRequest(BaseModel):
    """Quiz request without user_id (taken from authentication)"""
    course_id: str
    num_questions: int = 5
    difficulty: str = "medium"
    quiz_type: str = "multiple_choice"

class QuizEvaluationRequest(BaseModel):
    """Quiz evaluation request"""
    questions: List[Dict[str, Any]]
    user_answers: Dict[str, str]

class QuizEvaluationResponse(BaseModel):
    """Quiz evaluation response"""
    total_questions: int
    correct_answers: int
    score_percentage: float
    question_results: List[Dict[str, Any]]

def get_user_from_request(request: Request) -> Optional[User]:
    """Extract and verify user from request"""
    try:
        # Try to get from request state (set by middleware)
        if hasattr(request.state, 'user'):
            return request.state.user
        
        # Try to extract token manually
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]
            user = auth_service.get_current_user(token)
            return user
        
        # Try X-Auth-Token header
        token_header = request.headers.get("X-Auth-Token")
        if token_header:
            user = auth_service.get_current_user(token_header)
            return user
        
        return None
    except Exception as e:
        print(f"Error extracting user from request: {e}")
        return None

@router.post("/generate", response_model=QuizResponse)
async def generate_quiz(
    request_data: AuthenticatedQuizRequest,
    request: Request
):
    """Generate quiz from study materials"""
    try:
        # Get user manually
        current_user = get_user_from_request(request)
        if not current_user:
            raise HTTPException(401, "Authentication required")
        
        user_id = str(current_user.id)
        
        questions = quiz_service.generate_quiz(
            user_id,
            request_data.course_id,
            request_data.num_questions,
            request_data.difficulty,
            request_data.quiz_type
        )
        
        # Log quiz generation
        try:
            log_activity(user_id, "quiz", {})
        except:
            pass  # Don't fail if logging fails
        
        return QuizResponse(questions=questions)
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in generate_quiz: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(500, f"Error generating quiz: {str(e)}")

@router.post("/evaluate", response_model=QuizEvaluationResponse)
async def evaluate_quiz(
    request_data: QuizEvaluationRequest,
    request: Request
):
    """Evaluate quiz answers with semantic understanding"""
    print("=" * 50)
    print("QUIZ EVALUATION ENDPOINT CALLED")
    print("=" * 50)
    
    try:
        print("Step 1: Extracting user from request...")
        
        # Get user manually
        current_user = get_user_from_request(request)
        
        print(f"Step 2: User extracted: {current_user}")
        
        if not current_user:
            print("ERROR: No user found in request")
            raise HTTPException(401, "Authentication required")
        
        user_id = str(current_user.id)
        print(f"Step 3: User ID: {user_id}")
        
        print(f"Step 4: Number of questions: {len(request_data.questions)}")
        print(f"Step 5: Number of answers: {len(request_data.user_answers)}")
        
        # Evaluate the quiz
        print("Step 6: Starting quiz evaluation...")
        results = quiz_service.evaluate_quiz(
            request_data.questions,
            request_data.user_answers
        )
        
        print(f"Step 7: Evaluation complete - {results['correct_answers']}/{results['total_questions']} ({results['score_percentage']}%)")
        
        # Log quiz completion (wrapped in try-except to prevent failures)
        print("Step 8: Logging activity...")
        try:
            log_activity(user_id, "quiz_completed", {
                "score": results["score_percentage"],
                "total_questions": results["total_questions"],
                "correct_answers": results["correct_answers"]
            })
            print("Step 9: Activity logged successfully")
        except Exception as log_error:
            print(f"Step 9: Failed to log activity (non-critical): {log_error}")
        
        print("Step 10: Returning results...")
        print("=" * 50)
        return QuizEvaluationResponse(**results)
    
    except HTTPException as he:
        print(f"HTTPException raised: {he.status_code} - {he.detail}")
        raise
    except Exception as e:
        print(f"CRITICAL ERROR in evaluate_quiz: {str(e)}")
        print(traceback.format_exc())
        print("=" * 50)
        raise HTTPException(500, f"Error evaluating quiz: {str(e)}")
