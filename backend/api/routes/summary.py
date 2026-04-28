from fastapi import APIRouter, HTTPException, Depends, Request
from models.schemas import SummaryRequest, SummaryResponse
from services.summary_service import SummaryService
from api.routes.auth import get_authenticated_user
from api.routes.stats import log_activity
from models.auth_models import User
from pydantic import BaseModel
from typing import Optional

router = APIRouter()
summary_service = SummaryService()

class AuthenticatedSummaryRequest(BaseModel):
    """Summary request without user_id (taken from authentication)"""
    course_id: str
    document_name: Optional[str] = None
    style: str = "detailed"

@router.post("/generate", response_model=SummaryResponse)
async def generate_summary(
    request: Request,
    payload: AuthenticatedSummaryRequest,
    current_user: User = Depends(get_authenticated_user)
):
    """Generate summary of documents"""
    try:
        user_id = str(current_user.id)
        api_key = getattr(request.state, "groq_api_key", None)
        
        result = summary_service.generate_summary(
            user_id,
            payload.course_id,
            payload.document_name,
            payload.style,
            api_key=api_key
        )
        
        # If it's the new dict format, return as is
        if isinstance(result, dict):
            try:
                log_activity(user_id, "study_session", {"hours": 10/60, "course_id": payload.course_id})
            except:
                pass
            return SummaryResponse(**result)
        
        # Fallback for old string format
        try:
            log_activity(user_id, "study_session", {"hours": 10/60, "course_id": payload.course_id})
        except:
            pass
        return SummaryResponse(summary=result)
    
    except Exception as e:
        raise HTTPException(500, str(e))
