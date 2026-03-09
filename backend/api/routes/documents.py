from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from services.document_processor import DocumentProcessor
import os
import shutil
from config import settings
import traceback

router = APIRouter()
doc_processor = DocumentProcessor()

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    user_id: str = Form(...),
    course_id: str = Form(...)
):
    """Upload and process document"""
    try:
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

@router.get("/list/{user_id}/{course_id}")
async def list_documents(user_id: str, course_id: str):
    """List all documents for a course"""
    try:
        user_dir = os.path.join(settings.UPLOAD_DIR, user_id, course_id)
        
        if not os.path.exists(user_dir):
            return {"documents": []}
        
        files = os.listdir(user_dir)
        return {"documents": files}
    except Exception as e:
        print(f"Error in list_documents: {str(e)}")
        raise HTTPException(500, f"Error listing documents: {str(e)}")
