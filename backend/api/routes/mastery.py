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
