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

@router.post("/health")
async def health_check():
    """Simple health check for AI tutor connectivity"""
    try:
        # Test LLM connection
        from models.global_models import get_llm
        llm = get_llm()
        
        # Simple test query
        test_response = llm.invoke("Say 'OK' if you can respond.")
        
        return {
            "status": "healthy",
            "llm_connected": True,
            "test_response": test_response[:50] + "..." if len(test_response) > 50 else test_response
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "llm_connected": False,
            "error": str(e)
        }

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
        def generate_stream():
            try:
                stream = rag_service.answer_question_stream(
                    user_id,
                    request.course_id,
                    request.question,
                    request.use_eli12
                )
                
                for chunk in stream:
                    yield chunk
                    
            except Exception as e:
                print(f"Streaming error: {str(e)}")
                # Fallback to non-streaming response
                try:
                    result = rag_service.answer_question(
                        user_id,
                        request.course_id,
                        request.question,
                        request.use_eli12
                    )
                    
                    # Send as streaming format
                    yield f"data: {json.dumps({'type': 'metadata', 'sources': result.get('sources', []), 'has_context': result.get('has_context', False)})}\n\n"
                    yield f"data: {json.dumps({'type': 'content', 'text': result['answer']})}\n\n"
                    yield f"data: {json.dumps({'type': 'done'})}\n\n"
                    
                except Exception as fallback_error:
                    yield f"data: {json.dumps({'type': 'error', 'message': f'Both streaming and fallback failed: {str(fallback_error)}'})}\n\n"
        
        return StreamingResponse(generate_stream(), media_type="text/event-stream")
    
    except Exception as e:
        print(f"Error in ask_question_stream: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(500, f"Error answering question: {str(e)}")

@router.post("/debug/vector-store")
async def debug_vector_store(
    course_id: str,
    current_user: User = Depends(get_authenticated_user)
):
    """Debug endpoint to check vector store status"""
    try:
        user_id = str(current_user.id)
        
        # Check if vector store exists
        from services.document_processor import DocumentProcessor
        doc_processor = DocumentProcessor()
        vector_store = doc_processor.get_vector_store(user_id, course_id)
        
        if not vector_store:
            return {
                "status": "no_vector_store",
                "message": f"No vector store found for user {user_id}, course {course_id}",
                "path": f"vector_store/{user_id}_{course_id}"
            }
        
        # Test vector store
        test_docs = vector_store.similarity_search("test", k=3)
        
        return {
            "status": "vector_store_found",
            "document_count": len(test_docs),
            "sample_metadata": [doc.metadata for doc in test_docs[:2]],
            "path": f"vector_store/{user_id}_{course_id}"
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }

@router.get("/memory/status")
async def get_memory_status(
    course_id: str,
    current_user: User = Depends(get_authenticated_user)
):
    """Get conversation memory status for current user and course"""
    try:
        user_id = str(current_user.id)
        status = rag_service.get_memory_status(user_id, course_id)
        return status
    except Exception as e:
        print(f"Error getting memory status: {str(e)}")
        raise HTTPException(500, f"Error getting memory status: {str(e)}")

@router.delete("/memory/clear")
async def clear_memory(
    course_id: str,
    current_user: User = Depends(get_authenticated_user)
):
    """Clear conversation memory for current user and course"""
    try:
        user_id = str(current_user.id)
        rag_service.clear_memory(user_id, course_id)
        return {"message": "Memory cleared successfully"}
    except Exception as e:
        print(f"Error clearing memory: {str(e)}")
        raise HTTPException(500, f"Error clearing memory: {str(e)}")
