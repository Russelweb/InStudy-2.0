"""
InSpace Fast API endpoints.
Provides workspace creation, retrieval, updates, and chat tutoring.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from api.routes.auth import get_authenticated_user
from models.auth_models import User
from database.inspace_db import inspace_db
from services.inspace_service import inspace_service
import logging
from typing import List, Optional, Dict, Any

logger = logging.getLogger(__name__)

router = APIRouter()

# --- Request/Response Models ---
class CreateCanvasRequest(BaseModel):
    topic: str
    document_id: Optional[str] = None # Optional grounding document

class UpdateMasteryRequest(BaseModel):
    mastery: float
    confidence: float
    attempts_increment: Optional[int] = 1
    time_increment: Optional[int] = 0

class UpdateNotesRequest(BaseModel):
    notes: str
    is_bookmarked: int # 0 or 1

class AskQuestionRequest(BaseModel):
    node_id: str
    label: str
    question: str

# --- Endpoints ---

@router.post("/generate")
async def generate_canvas(
    request: CreateCanvasRequest,
    current_user: User = Depends(get_authenticated_user)
):
    """Generate structural learning canvas breakdown (Standalone or Grounded)"""
    try:
        user_id = str(current_user.id)
        result = inspace_service.generate_breakdown(
            topic=request.topic,
            user_id=user_id,
            document_id=request.document_id
        )
        return result
    except Exception as e:
        logger.error(f"InSpace generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/list")
async def list_canvases(
    current_user: User = Depends(get_authenticated_user)
):
    """Retrieve all canvases created by the user"""
    try:
        user_id = str(current_user.id)
        canvases = inspace_db.get_user_canvases(user_id)
        return {"canvases": canvases}
    except Exception as e:
        logger.error(f"Error listing canvases: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/canvas/{canvas_id}")
async def get_canvas(
    canvas_id: str,
    current_user: User = Depends(get_authenticated_user)
):
    """Load structural nodes and edges for a canvas workspace"""
    try:
        canvas = inspace_db.get_canvas(canvas_id)
        if not canvas:
            raise HTTPException(status_code=404, detail="Canvas not found")
        # Ensure owner match
        if canvas.get("user_id") != str(current_user.id):
            raise HTTPException(status_code=403, detail="Access denied")
        return canvas
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error fetching canvas: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/canvas/{canvas_id}/node/{node_id}/details")
async def get_node_details(
    canvas_id: str,
    node_id: str,
    label: str,
    topic: str,
    document_id: Optional[str] = None,
    current_user: User = Depends(get_authenticated_user)
):
    """Get or generate detailed explanation card, summaries, and quizzes for a node"""
    try:
        user_id = str(current_user.id)
        node_details = inspace_service.generate_node_details(
            canvas_id=canvas_id,
            node_id=node_id,
            label=label,
            topic=topic,
            document_id=document_id,
            user_id=user_id
        )
        return node_details
    except Exception as e:
        logger.error(f"Error fetching node details: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/canvas/{canvas_id}/node/{node_id}/mastery")
async def update_node_mastery(
    canvas_id: str,
    node_id: str,
    request: UpdateMasteryRequest,
    current_user: User = Depends(get_authenticated_user)
):
    """Update node mastery state based on quiz responses or review attempts"""
    try:
        success = inspace_db.update_node_mastery(
            canvas_id=canvas_id,
            node_id=node_id,
            mastery=request.mastery,
            confidence=request.confidence,
            attempts_increment=request.attempts_increment,
            time_increment=request.time_increment
        )
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update node progress database")
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error updating node mastery: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/canvas/{canvas_id}/node/{node_id}/notes")
async def update_node_notes(
    canvas_id: str,
    node_id: str,
    request: UpdateNotesRequest,
    current_user: User = Depends(get_authenticated_user)
):
    """Update concept node notes or bookmark flag"""
    try:
        success = inspace_db.update_node_notes(
            canvas_id=canvas_id,
            node_id=node_id,
            notes=request.notes,
            is_bookmarked=request.is_bookmarked
        )
        if not success:
            raise HTTPException(status_code=500, detail="Failed to save node notes")
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error saving node notes: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/canvas/{canvas_id}/ask")
async def ask_node_question(
    canvas_id: str,
    request: AskQuestionRequest,
    current_user: User = Depends(get_authenticated_user)
):
    """Contextual AI tutoring question about a specific concept node"""
    try:
        user_id = str(current_user.id)
        answer = inspace_service.answer_contextual_question(
            canvas_id=canvas_id,
            node_id=request.node_id,
            label=request.label,
            question=request.question,
            user_id=user_id
        )
        return {"answer": answer}
    except Exception as e:
        logger.error(f"Error in contextual InSpace chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/canvas/{canvas_id}")
async def delete_canvas(
    canvas_id: str,
    current_user: User = Depends(get_authenticated_user)
):
    """Delete a canvas and all associated connections"""
    try:
        canvas = inspace_db.get_canvas(canvas_id)
        if not canvas:
            raise HTTPException(status_code=404, detail="Canvas not found")
        if canvas.get("user_id") != str(current_user.id):
            raise HTTPException(status_code=403, detail="Access denied")
            
        success = inspace_db.delete_canvas(canvas_id)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete canvas from database")
        return {"status": "success", "message": "Canvas deleted successfully"}
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error deleting canvas: {e}")
        raise HTTPException(status_code=500, detail=str(e))
