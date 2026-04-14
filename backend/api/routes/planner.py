from fastapi import APIRouter, HTTPException, Depends, Request
from models.schemas import StudyPlanRequest, StudyPlanResponse
from services.planner_service import PlannerService
from api.routes.auth import get_authenticated_user
from models.auth_models import User
from pydantic import BaseModel
from typing import List

import logging
import traceback

logger = logging.getLogger(__name__)

router = APIRouter()
planner_service = PlannerService()

class AuthenticatedStudyPlanRequest(BaseModel):
    """Study plan request (user_id taken from authentication)"""
    course_id: str
    course_name: str
    exam_date: str
    topics: List[str]

@router.post("/create", response_model=StudyPlanResponse)
async def create_study_plan(
    request: Request,
    payload: AuthenticatedStudyPlanRequest,
    current_user: User = Depends(get_authenticated_user)
):
    """Create personalized study plan"""
    try:
        user_id = str(current_user.id)
        api_key = getattr(request.state, "groq_api_key", None)
        
        logger.info(f"Creating study plan for user {user_id} and course {payload.course_id}")
        plan = planner_service.create_study_plan(
            user_id,
            payload.course_id,
            payload.course_name,
            payload.exam_date,
            payload.topics,
            api_key=api_key
        )
        
        return StudyPlanResponse(plan=plan)
    except Exception as e:
        logger.error(f"Error in create_study_plan: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(500, str(e))

@router.get("/discover/{course_id}")
async def discover_topics(
    course_id: str,
    current_user: User = Depends(get_authenticated_user)
):
    """Discover potential study topics from course documents"""
    try:
        user_id = str(current_user.id)
        topics = planner_service.discover_topics(user_id, course_id)
        return {"topics": topics}
    except Exception as e:
        logger.error(f"Error in discover_topics: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(500, str(e))
