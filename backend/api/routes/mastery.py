"""
Mastery tracking API endpoints.
Provides methods to record and retrieve user's understanding of concepts.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from api.routes.auth import get_authenticated_user
from models.auth_models import User
from database.mastery_db import mastery_db
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)

router = APIRouter()

class MasteryUpdateRequest(BaseModel):
    course_id: str
    concept_id: str
    familiarity: int # -1: Unfamiliar, 0: Familiar, 1: Mastered

@router.post("/update")
async def update_mastery(
    request: MasteryUpdateRequest,
    current_user: User = Depends(get_authenticated_user)
):
    """Update user's mastery score for a specific concept"""
    try:
        user_id = str(current_user.id)
        
        success = mastery_db.update_mastery(
            user_id,
            request.course_id,
            request.concept_id,
            request.familiarity
        )
        
        if success:
            return {"status": "success", "message": "Mastery profile updated."}
        else:
            raise HTTPException(500, "Failed to update mastery database.")
    
    except Exception as e:
        logger.error(f"Mastery API error: {e}")
        raise HTTPException(500, str(e))

@router.get("/profile/{course_id}")
async def get_mastery_profile(
    course_id: str,
    current_user: User = Depends(get_authenticated_user)
):
    """Retrieve user's complete mastery profile for a course"""
    try:
        user_id = str(current_user.id)
        profile = mastery_db.get_user_mastery(user_id, course_id)
        return {"course_id": course_id, "profile": profile}
    except Exception as e:
        logger.error(f"Error fetching mastery profile: {e}")
        raise HTTPException(500, str(e))

@router.get("/history/{course_id}")
async def get_mastery_history(
    course_id: str,
    days: int = 30,
    current_user: User = Depends(get_authenticated_user)
):
    """Retrieve historical mastery data for charting"""
    try:
        user_id = str(current_user.id)
        history = mastery_db.get_mastery_history(user_id, course_id, days)
        return {"course_id": course_id, "history": history, "days": days}
    except Exception as e:
        logger.error(f"Error fetching mastery history: {e}")
        raise HTTPException(500, str(e))

@router.get("/stats/{course_id}")
async def get_mastery_stats(
    course_id: str,
    current_user: User = Depends(get_authenticated_user)
):
    """Retrieve aggregate mastery statistics"""
    try:
        user_id = str(current_user.id)
        stats = mastery_db.get_concept_stats(user_id, course_id)
        return {"course_id": course_id, "stats": stats}
    except Exception as e:
        logger.error(f"Error fetching mastery stats: {e}")
        raise HTTPException(500, str(e))

@router.get("/stale/{course_id}")
async def get_stale_concepts(
    course_id: str,
    days: int = 14,
    current_user: User = Depends(get_authenticated_user)
):
    """Retrieve concepts that need review (haven't been studied recently)"""
    try:
        user_id = str(current_user.id)
        stale = mastery_db.get_stale_concepts(user_id, course_id, days)
        return {"course_id": course_id, "stale_concepts": stale, "threshold_days": days}
    except Exception as e:
        logger.error(f"Error fetching stale concepts: {e}")
        raise HTTPException(500, str(e))

@router.get("/review-schedule/{course_id}")
async def get_review_schedule(
    course_id: str,
    current_user: User = Depends(get_authenticated_user)
):
    """Get recommended review schedule based on forgetting curve"""
    try:
        user_id = str(current_user.id)
        schedule = mastery_db.get_review_schedule(user_id, course_id)
        return {"course_id": course_id, "schedule": schedule}
    except Exception as e:
        logger.error(f"Error generating review schedule: {e}")
        raise HTTPException(500, str(e))

@router.post("/apply-decay/{course_id}")
async def apply_decay(
    course_id: str,
    current_user: User = Depends(get_authenticated_user)
):
    """Manually trigger forgetting curve decay for all concepts"""
    try:
        user_id = str(current_user.id)
        updated_count = mastery_db.apply_decay_to_all_concepts(user_id, course_id)
        return {
            "course_id": course_id, 
            "updated_concepts": updated_count,
            "message": f"Applied decay to {updated_count} concepts"
        }
    except Exception as e:
        logger.error(f"Error applying decay: {e}")
        raise HTTPException(500, str(e))
from api.routes.stats import clear_course_activity

@router.post("/reset/{course_id}")
async def reset_mastery(
    course_id: str,
    current_user: User = Depends(get_authenticated_user)
):
    """Completely reset user's mastery progress for a course"""
    try:
        user_id = str(current_user.id)
        
        # 1. Clear Neural Mastery Database
        success = mastery_db.clear_mastery(user_id, course_id)
        
        # 2. Clear Activity Logs (Quiz results, etc.)
        clear_course_activity(user_id, course_id)
        
        if success:
            return {"status": "success", "message": "Mastery progress has been reset."}
        else:
            raise HTTPException(500, "Failed to reset mastery data.")
    except Exception as e:
        logger.error(f"Error resetting mastery: {e}")
        raise HTTPException(500, str(e))
