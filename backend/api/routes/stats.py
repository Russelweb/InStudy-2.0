from fastapi import APIRouter, HTTPException
from pathlib import Path
from config import settings
import os
from datetime import datetime
import json

router = APIRouter()

def get_user_stats(user_id: str):
    """Get user statistics from file system"""
    user_upload_dir = Path(settings.UPLOAD_DIR) / user_id
    
    stats = {
        "total_documents": 0,
        "total_courses": 0,
        "courses": [],
        "recent_questions": [],
        "study_hours": 0,
        "quizzes_taken": 0
    }
    
    if not user_upload_dir.exists():
        return stats
    
    # Count courses and documents
    courses = [d for d in user_upload_dir.iterdir() if d.is_dir()]
    stats["total_courses"] = len(courses)
    
    for course_dir in courses:
        documents = [f for f in course_dir.iterdir() if f.is_file()]
        stats["total_documents"] += len(documents)
        
        stats["courses"].append({
            "name": course_dir.name.replace("_", " ").title(),
            "id": course_dir.name,
            "document_count": len(documents),
            "documents": [f.name for f in documents]
        })
    
    # Load activity log if exists
    activity_file = user_upload_dir / "activity.json"
    if activity_file.exists():
        try:
            with open(activity_file, 'r') as f:
                activity = json.load(f)
                stats["recent_questions"] = activity.get("questions", [])[-10:]  # Last 10
                stats["quizzes_taken"] = activity.get("quizzes_taken", 0)
                stats["study_hours"] = activity.get("study_hours", 0)
        except:
            pass
    
    return stats

def log_activity(user_id: str, activity_type: str, data: dict):
    """Log user activity"""
    user_upload_dir = Path(settings.UPLOAD_DIR) / user_id
    user_upload_dir.mkdir(parents=True, exist_ok=True)
    
    activity_file = user_upload_dir / "activity.json"
    
    # Load existing activity
    activity = {
        "questions": [],
        "quizzes_taken": 0,
        "study_hours": 0,
        "last_updated": None
    }
    
    if activity_file.exists():
        try:
            with open(activity_file, 'r') as f:
                activity = json.load(f)
        except:
            pass
    
    # Update activity
    if activity_type == "question":
        activity["questions"].append({
            "question": data.get("question"),
            "course": data.get("course"),
            "timestamp": datetime.now().isoformat()
        })
        # Keep only last 50 questions
        activity["questions"] = activity["questions"][-50:]
    
    elif activity_type == "quiz":
        activity["quizzes_taken"] = activity.get("quizzes_taken", 0) + 1
    
    elif activity_type == "study_session":
        activity["study_hours"] = activity.get("study_hours", 0) + data.get("hours", 0)
    
    activity["last_updated"] = datetime.now().isoformat()
    
    # Save activity
    with open(activity_file, 'w') as f:
        json.dump(activity, f, indent=2)

@router.get("/stats/{user_id}")
async def get_stats(user_id: str):
    """Get user statistics"""
    try:
        stats = get_user_stats(user_id)
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/activity/{user_id}")
async def log_user_activity(user_id: str, activity_type: str, data: dict):
    """Log user activity"""
    try:
        log_activity(user_id, activity_type, data)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/courses/{user_id}")
async def get_user_courses(user_id: str):
    """Get all courses for a user"""
    try:
        stats = get_user_stats(user_id)
        return {"courses": stats["courses"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
