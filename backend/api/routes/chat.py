from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import StreamingResponse
from models.schemas import ChatRequest, ChatResponse
from services.rag_service import RAGService
from api.routes.stats import log_activity
from api.routes.auth import get_authenticated_user
from models.auth_models import User
from pydantic import BaseModel
import traceback
import json
import uuid

router = APIRouter()
rag_service = RAGService()


class AuthenticatedChatRequest(BaseModel):
    """Chat request without user_id (taken from authentication)"""
    course_id: str
    question: str
    use_eli12: bool = False
    personality: str = "strict"
    session_id: str = ""   # frontend passes a UUID that persists for the browser session

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
    request: Request,
    payload: AuthenticatedChatRequest,
    current_user: User = Depends(get_authenticated_user)
):
    """Ask AI tutor a question"""
    try:
        user_id = str(current_user.id)
        api_key = getattr(request.state, "groq_api_key", None)
        
        result = rag_service.answer_question(
            user_id,
            payload.course_id,
            payload.question,
            payload.use_eli12,
            api_key=api_key,
            personality=payload.personality
        )
        
        # Log the question
        log_activity(user_id, "question", {
            "question": payload.question,
            "course": payload.course_id
        })
        
        return ChatResponse(**result)
    
    except Exception as e:
        print(f"Error in ask_question: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(500, f"Error answering question: {str(e)}")

@router.post("/ask-stream")
async def ask_question_stream(
    request: Request,
    payload: AuthenticatedChatRequest,
    current_user: User = Depends(get_authenticated_user)
):
    """Ask AI tutor a question with streaming response"""
    try:
        user_id = str(current_user.id)
        api_key = getattr(request.state, "groq_api_key", None)

        # Ensure session_id is always a valid UUID — generate one if frontend didn't send it
        session_id = payload.session_id.strip() if payload.session_id.strip() else str(uuid.uuid4())
        
        # Log the question
        log_activity(user_id, "question", {
            "question": payload.question,
            "course": payload.course_id
        })

        # Run trajectory analysis + pending XP AFTER streaming completes.
        # We do this in the background so it never delays the SSE stream.
        assessment_result: dict = {}

        async def run_mastery_analysis():
            try:
                from services.tutor_mastery_service import tutor_mastery_service
                from database.mastery_v2_db import mastery_v2_db
                memory_key = rag_service._get_memory_key(user_id, payload.course_id)
                history = rag_service.conversation_memory.get(memory_key, [])
                result = await tutor_mastery_service.process_tutor_exchange(
                    user_id=user_id,
                    course_id=payload.course_id,
                    session_id=session_id,
                    conversation_history=history,
                    api_key=api_key,
                )
                assessment_result.update(result)
            except Exception as _e:
                import logging as _log
                _log.getLogger(__name__).debug(f"Mastery analysis error (non-fatal): {_e}")

        async def generate_stream():
            try:
                import asyncio

                # Collect all chunks from the sync generator in a thread
                # then yield them — preserves streaming to the client
                loop = asyncio.get_event_loop()

                def _run_sync():
                    return list(rag_service.answer_question_stream(
                        user_id,
                        payload.course_id,
                        payload.question,
                        payload.use_eli12,
                        api_key=api_key,
                        personality=payload.personality,
                        session_id=session_id,
                    ))

                chunks = await loop.run_in_executor(None, _run_sync)

                # Strip the 'done' event from the RAG generator — we replace it
                # with our own 'assessment_check' terminal event below
                for chunk in chunks:
                    if chunk.strip() == 'data: {"type": "done"}':
                        continue
                    yield chunk

                # After all chunks sent, run mastery analysis (async, non-blocking)
                await run_mastery_analysis()

                # Send ONE terminal event — either with assessment or plain done
                if assessment_result.get("assessment_ready") and assessment_result.get("micro_assessment"):
                    yield f"data: {json.dumps({'type': 'assessment_check', 'session_id': session_id, 'assessment_ready': True, 'micro_assessment': assessment_result.get('micro_assessment'), 'trajectory': assessment_result.get('trajectory'), 'pending_xp': assessment_result.get('pending_xp', 0)})}\n\n"
                else:
                    yield f"data: {json.dumps({'type': 'done'})}\n\n"

            except Exception as e:
                import traceback as tb
                print(f"Streaming error: {str(e)}")
                try:
                    result = rag_service.answer_question(
                        user_id,
                        payload.course_id,
                        payload.question,
                        payload.use_eli12,
                        api_key=api_key,
                        personality=payload.personality
                    )
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
