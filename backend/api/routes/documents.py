from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from services.document_processor import DocumentProcessor
from api.routes.auth import get_authenticated_user
from api.routes.stats import log_activity
from models.auth_models import User
import os
import shutil
from config import settings
import traceback

router = APIRouter()
doc_processor = DocumentProcessor()

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    course_id: str = Form(...),
    current_user: User = Depends(get_authenticated_user)
):
    """Upload and process document"""
    try:
        user_id = str(current_user.id)
        
        # Validate file type
        allowed_extensions = ['.pdf', '.txt', '.docx']
        file_ext = os.path.splitext(file.filename)[1].lower()
        
        if file_ext not in allowed_extensions:
            raise HTTPException(400, f"Unsupported file type: {file_ext}")
        
        # Save file
        user_dir = os.path.join(settings.UPLOAD_DIR, user_id, course_id)
        os.makedirs(user_dir, exist_ok=True)
        
        file_path = os.path.join(user_dir, file.filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Process document
        num_chunks = doc_processor.process_document(
            file_path, user_id, course_id, file.filename
        )
        
        # Log document upload activity
        log_activity(user_id, "document_upload", {
            "filename": file.filename,
            "course": course_id,
            "chunks": num_chunks
        })
        
        return {
            "message": "Document uploaded successfully",
            "filename": file.filename,
            "chunks": num_chunks
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in upload_document: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(500, f"Error processing document: {str(e)}")

@router.get("/list/{course_id}")
async def list_documents(
    course_id: str,
    current_user: User = Depends(get_authenticated_user)
):
    """List all documents for a course"""
    try:
        user_id = str(current_user.id)
        user_dir = os.path.join(settings.UPLOAD_DIR, user_id, course_id)
        
        if not os.path.exists(user_dir):
            return {"documents": []}
        
        files = os.listdir(user_dir)
        return {"documents": files}
    except Exception as e:
        print(f"Error in list_documents: {str(e)}")
        raise HTTPException(500, f"Error listing documents: {str(e)}")
