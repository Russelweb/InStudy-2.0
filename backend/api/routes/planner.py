from fastapi import APIRouter, HTTPException
from models.schemas import StudyPlanRequest, StudyPlanResponse
from services.planner_service import PlannerService

router = APIRouter()
planner_service = PlannerService()

@router.post("/create", response_model=StudyPlanResponse)
async def create_study_plan(request: StudyPlanRequest):
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
