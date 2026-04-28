"""
Admin API routes for user and system management.
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List
import logging
import shutil
from pathlib import Path
import os
import json

from models.auth_models import User
from services.auth_service import auth_service
from api.routes.auth import get_authenticated_user
from config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

def require_admin(current_user: User = Depends(get_authenticated_user)) -> User:
    """Dependency to ensure user is an admin"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return current_user

@router.get("/users")
async def get_all_users(admin: User = Depends(require_admin)):
    """Get all users (admin only)"""
    try:
        users = auth_service.auth_db.get_all_users()
        return {"users": users}
    except Exception as e:
        logger.error(f"Error getting users: {e}")
        raise HTTPException(status_code=500, detail="Failed to get users")

@router.delete("/users/{user_id}")
async def delete_user(user_id: int, admin: User = Depends(require_admin)):
    """Delete a user and all their data (admin only)"""
    try:
        if user_id == admin.id:
            raise HTTPException(status_code=400, detail="Cannot delete your own account")
        
        success = auth_service.auth_db.delete_user(user_id)
        if not success:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_upload_dir = Path(settings.UPLOAD_DIR) / str(user_id)
        if user_upload_dir.exists():
            shutil.rmtree(user_upload_dir)
            logger.info(f"Deleted upload directory for user {user_id}")
        
        vector_store_dir = Path(settings.VECTOR_STORE_DIR)
        for vector_dir in vector_store_dir.glob(f"{user_id}_*"):
            shutil.rmtree(vector_dir)
            logger.info(f"Deleted vector store: {vector_dir.name}")
        
        return {"message": f"User {user_id} deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting user: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete user")

@router.post("/users/{user_id}/make-admin")
async def make_user_admin(user_id: int, admin: User = Depends(require_admin)):
    """Grant admin privileges to a user (admin only)"""
    try:
        success = auth_service.auth_db.make_admin(user_id)
        if not success:
            raise HTTPException(status_code=404, detail="User not found")
        return {"message": f"User {user_id} is now an admin"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error making user admin: {e}")
        raise HTTPException(status_code=500, detail="Failed to grant admin privileges")

@router.post("/users/{user_id}/revoke-admin")
async def revoke_user_admin(user_id: int, admin: User = Depends(require_admin)):
    """Revoke admin privileges from a user (admin only)"""
    try:
        if user_id == admin.id:
            raise HTTPException(status_code=400, detail="Cannot revoke your own admin privileges")
        
        success = auth_service.auth_db.revoke_admin(user_id)
        if not success:
            raise HTTPException(status_code=404, detail="User not found")
        return {"message": f"Admin privileges revoked from user {user_id}"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error revoking admin: {e}")
        raise HTTPException(status_code=500, detail="Failed to revoke admin privileges")

@router.delete("/courses/{user_id}/{course_id}")
async def delete_course(user_id: int, course_id: str, admin: User = Depends(require_admin)):
    """Delete a course and all its data (admin only)"""
    try:
        course_dir = Path(settings.UPLOAD_DIR) / str(user_id) / course_id
        if course_dir.exists():
            shutil.rmtree(course_dir)
            logger.info(f"Deleted course directory: {course_dir}")
        
        vector_store_path = Path(settings.VECTOR_STORE_DIR) / f"{user_id}_{course_id}"
        if vector_store_path.exists():
            shutil.rmtree(vector_store_path)
            logger.info(f"Deleted vector store: {vector_store_path}")
        
        return {"message": f"Course {course_id} deleted successfully"}
    except Exception as e:
        logger.error(f"Error deleting course: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete course")

@router.get("/stats")
async def get_system_stats(admin: User = Depends(require_admin)):
    """Get system-wide statistics (admin only)"""
    try:
        users = auth_service.auth_db.get_all_users()
        total_documents = 0
        total_courses = 0
        
        upload_dir = Path(settings.UPLOAD_DIR)
        if upload_dir.exists():
            for user_dir in upload_dir.iterdir():
                if user_dir.is_dir() and user_dir.name.isdigit():
                    courses = [d for d in user_dir.iterdir() if d.is_dir() and d.name != "activity.json"]
                    total_courses += len(courses)
                    for course_dir in courses:
                        documents = [f for f in course_dir.iterdir() if f.is_file() and not f.name.endswith(".json")]
                        total_documents += len(documents)
        
        return {
            "total_users": len(users),
            "total_admins": sum(1 for u in users if u.get('is_admin')),
            "total_documents": total_documents,
            "total_courses": total_courses
        }
    except Exception as e:
        logger.error(f"Error getting system stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to get system stats")
@router.get("/users/{user_id}/courses")
async def get_user_courses(user_id: int, admin: User = Depends(require_admin)):
    """Get all courses for a specific user (admin only)"""
    try:
        user_dir = Path(settings.UPLOAD_DIR) / str(user_id)
        
        if not user_dir.exists():
            return {"courses": []}
        
        courses = []
        for course_dir in user_dir.iterdir():
            if course_dir.is_dir() and course_dir.name != "activity.json":
                documents = [f.name for f in course_dir.iterdir() if f.is_file() and not f.name.endswith(".json")]
                courses.append({
                    "id": course_dir.name,
                    "name": course_dir.name.replace("_", " ").title(),
                    "document_count": len(documents),
                    "documents": documents
                })
        
        return {"courses": courses}
        
    except Exception as e:
        logger.error(f"Error getting user courses: {e}")
        raise HTTPException(status_code=500, detail="Failed to get user courses")

@router.get("/courses/all")
async def get_all_courses(admin: User = Depends(require_admin)):
    """List all courses and documents across all users (admin only)"""
    try:
        all_courses = []
        upload_dir = Path(settings.UPLOAD_DIR)
        
        if not upload_dir.exists():
            return {"courses": []}
            
        for user_dir in upload_dir.iterdir():
            if user_dir.is_dir() and user_dir.name.isdigit():
                user_id = user_dir.name
                user = auth_service.auth_db.get_user_by_id(int(user_id))
                user_email = user.get("email") if user else "Unknown"
                
                for course_dir in user_dir.iterdir():
                    if course_dir.is_dir() and course_dir.name != "activity.json":
                        documents = [f.name for f in course_dir.iterdir() if f.is_file() and not f.name.endswith(".json")]
                        all_courses.append({
                            "user_id": user_id,
                            "user_email": user_email,
                            "course_id": course_dir.name,
                            "course_name": course_dir.name.replace("_", " ").title(),
                            "document_count": len(documents),
                            "documents": documents
                        })
        return {"courses": all_courses}
    except Exception as e:
        logger.error(f"Error getting all courses: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve system courses")

@router.get("/interactions")
async def get_system_interactions(limit: int = 50, admin: User = Depends(require_admin)):
    """Monitor questions and interactions across all users (admin only)"""
    try:
        all_activities = []
        upload_dir = Path(settings.UPLOAD_DIR)
        
        for user_dir in upload_dir.iterdir():
            if user_dir.is_dir() and user_dir.name.isdigit():
                activity_file = user_dir / "activity.json"
                if activity_file.exists():
                    try:
                        with open(activity_file, 'r') as f:
                            activity = json.load(f)
                        
                        user_id = user_dir.name
                        user = auth_service.auth_db.get_user_by_id(int(user_id))
                        user_email = user.get("email") if user else "Unknown"
                        
                        for q in activity.get("questions", []):
                            all_activities.append({
                                "type": "question",
                                "user_id": user_id,
                                "user_email": user_email,
                                "course": q.get("course"),
                                "content": q.get("question"),
                                "timestamp": q.get("timestamp")
                            })
                    except: continue
        
        all_activities.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        return {"interactions": all_activities[:limit]}
    except Exception as e:
        logger.error(f"Error getting system interactions: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve interaction logs")

@router.delete("/documents/{user_id}/{course_id}/{filename}")
async def delete_specific_document(user_id: int, course_id: str, filename: str, admin: User = Depends(require_admin)):
    """Delete a specific document from a user's course (admin only)"""
    try:
        file_path = Path(settings.UPLOAD_DIR) / str(user_id) / course_id / filename
        if file_path.exists():
            os.remove(file_path)
            logger.info(f"Admin deleted document: {file_path}")
            
            annotations_path = Path(settings.UPLOAD_DIR) / str(user_id) / course_id / f"{filename}.annotations.json"
            if annotations_path.exists():
                os.remove(annotations_path)
            return {"message": f"Document {filename} deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="Document not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting document: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete specific document")