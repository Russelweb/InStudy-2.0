from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from models.schemas import ChatRequest, ChatResponse
from services.rag_service import RAGService
from api.routes.stats import log_activity
from api.routes.auth import get_authenticated_user
from models.auth_models import User
from pydantic import BaseModel
import traceback
import json

router = APIRouter()
rag_service = RAGService()

class AuthenticatedChatRequest(BaseModel):
    """Chat request without user_id (taken from authentication)"""
    course_id: str
    question: str
    use_eli12: bool = False

@router.post("/ask", response_model=ChatResponse)
async def ask_question(
    request: AuthenticatedChatRequest,
    current_user: User = Depends(get_authenticated_user)
):
    """Ask AI tutor a question"""
    try:
        user_id = str(current_user.id)
        
        result = rag_service.answer_question(
            user_id,
            request.course_id,
            request.question,
            request.use_eli12
        )
        
        # Log the question
        log_activity(user_id, "question", {
            "question": request.question,
            "course": request.course_id
        })
        
        return ChatResponse(**result)
    
    except Exception as e:
        print(f"Error in ask_question: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(500, f"Error answering question: {str(e)}")

@router.post("/ask-stream")
async def ask_question_stream(
    request: AuthenticatedChatRequest,
    current_user: User = Depends(get_authenticated_user)
):
    """Ask AI tutor a question with streaming response"""
    try:
        user_id = str(current_user.id)
        
        # Log the question
        log_activity(user_id, "question", {
            "question": request.question,
            "course": request.course_id
        })
        
        # Get streaming generator
        stream = rag_service.answer_question_stream(
            user_id,
            request.course_id,
            request.question,
            request.use_eli12
        )
        
        return StreamingResponse(stream, media_type="text/event-stream")
    
    except Exception as e:
        print(f"Error in ask_question_stream: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(500, f"Error answering question: {str(e)}")
