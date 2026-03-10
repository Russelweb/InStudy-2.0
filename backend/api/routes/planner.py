from fastapi import APIRouter, HTTPException, Depends
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
    request: AuthenticatedStudyPlanRequest,
    current_user: User = Depends(get_authenticated_user)
):
    """Create personalized study plan"""
    try:
        plan = planner_service.create_study_plan(
            request.course_name,
            request.exam_date,
            request.topics
        )
        
        return StudyPlanResponse(plan=plan)
    
    except Exception as e:
        raise HTTPException(500, str(e))
