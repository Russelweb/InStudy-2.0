from fastapi import APIRouter, HTTPException
from models.schemas import ChatRequest, ChatResponse
from services.rag_service import RAGService
import traceback

router = APIRouter()
rag_service = RAGService()

@router.post("/ask", response_model=ChatResponse)
async def ask_question(request: ChatRequest):
    """Ask AI tutor a question"""
    try:
        result = rag_service.answer_question(
            request.user_id,
            request.course_id,
            request.question,
            request.use_eli12
        )
        
        return ChatResponse(**result)
    
    except Exception as e:
        print(f"Error in ask_question: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(500, f"Error answering question: {str(e)}")
