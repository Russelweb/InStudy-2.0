from fastapi import APIRouter, HTTPException
from models.schemas import SummaryRequest, SummaryResponse
from services.summary_service import SummaryService

router = APIRouter()
summary_service = SummaryService()

@router.post("/generate", response_model=SummaryResponse)
async def generate_summary(request: SummaryRequest):
    """Generate summary of documents"""
    try:
        summary = summary_service.generate_summary(
            request.user_id,
            request.course_id,
            request.document_name,
            request.style
        )
        
        return SummaryResponse(summary=summary)
    
    except Exception as e:
        raise HTTPException(500, str(e))
