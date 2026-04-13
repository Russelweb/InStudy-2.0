from fastapi import APIRouter, HTTPException, Depends, Request
from models.schemas import StudyPlanRequest, StudyPlanResponse
from services.planner_service import PlannerService
from api.routes.auth import get_authenticated_user
from models.auth_models import User
from pydantic import BaseModel
from typing import List

router = APIRouter()
planner_service = PlannerService()

class AuthenticatedStudyPlanRequest(BaseModel):
    """Study plan request (user_id taken from authentication)"""
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
        
        plan = planner_service.create_study_plan(
            user_id,
            payload.course_name,
            payload.exam_date,
            payload.topics,
            api_key=api_key
        )
        
        return StudyPlanResponse(plan=plan)
    
    except Exception as e:
        raise HTTPException(500, str(e))
