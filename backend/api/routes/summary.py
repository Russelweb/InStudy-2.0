from fastapi import APIRouter, HTTPException, Depends
from models.schemas import SummaryRequest, SummaryResponse
from services.summary_service import SummaryService
from api.routes.auth import get_authenticated_user
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
    request: AuthenticatedSummaryRequest,
    current_user: User = Depends(get_authenticated_user)
):
    """Generate summary of documents"""
    try:
        user_id = str(current_user.id)
        
        summary = summary_service.generate_summary(
            user_id,
            request.course_id,
            request.document_name,
            request.style
        )
        
        return SummaryResponse(summary=summary)
    
    except Exception as e:
        raise HTTPException(500, str(e))
