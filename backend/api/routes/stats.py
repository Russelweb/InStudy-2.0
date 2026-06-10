from fastapi import APIRouter, HTTPException, Depends
from pathlib import Path
from config import settings
from api.routes.auth import get_authenticated_user
from models.auth_models import User
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
        "total_canvases": 0,
        "courses": [],
        "recent_questions": [],
        "study_hours": 0.0,
        "quizzes_taken": 0,
        "daily_activity": {},
    }

    if not user_upload_dir.exists():
        # Even if no upload dir, user might have canvases
        from database.inspace_db import inspace_db
        try:
            canvases = inspace_db.get_user_canvases(user_id)
            stats["total_canvases"] = len(canvases)
        except: pass
        return stats

    # Count canvases
    from database.inspace_db import inspace_db
    try:
        canvases = inspace_db.get_user_canvases(user_id)
        stats["total_canvases"] = len(canvases)
    except: pass

    # Count courses and documents (exclude annotation sidecar files)
    courses = [d for d in user_upload_dir.iterdir() if d.is_dir()]
    stats["total_courses"] = len(courses)

    # Load activity log
    activity_file = user_upload_dir / "activity.json"
    course_quiz_scores = {} # course_id -> [scores]
    
    if activity_file.exists():
        try:
            with open(activity_file, "r") as f:
                activity = json.load(f)
            
            # Extract quiz scores per course
            # We look for quiz_completed events that might have course info
            # In stats.py:log_activity, quiz_completed logs {score, total, correct} 
            # but currently it doesn't log the course_id! I need to fix log_activity too.
            # For now, let's assume we can match questions back to courses.
            
            stats["quizzes_taken"] = activity.get("quizzes_taken", 0)
            stats["recent_questions"] = activity.get("questions", [])[-10:]
            
            daily = activity.get("daily_activity", {})
            if not daily:
                daily = {}
                for q in activity.get("questions", []):
                    ts = q.get("timestamp", "")
                    if not ts: continue
                    date_key = ts[:10]
                    daily.setdefault(date_key, {"questions": 0, "quizzes": 0, "study_time": 0, "documents_uploaded": 0})
                    daily[date_key]["questions"] += 1
            
            stats["daily_activity"] = daily
            total_hours = 0.0
            for day_data in daily.values():
                # Explicit study sessions
                total_hours += day_data.get("study_time", 0)
                # Questions asked: ~2 min each
                total_hours += day_data.get("questions", 0) * 2 / 60
                # Quizzes taken: ~5 min each
                total_hours += day_data.get("quizzes", 0) * 5 / 60
                # Documents uploaded/reviewed: ~10 min each
                total_hours += day_data.get("documents_uploaded", 0) * 10 / 60
                # Flashcard sessions: ~3 min each
                total_hours += day_data.get("flashcards", 0) * 3 / 60
            stats["study_hours"] = round(total_hours, 2)
        except: pass

    # Build final course stats with mastery
    total_docs = 0

    # Load V2 mastery for all courses in one batch
    from database.mastery_v2_db import mastery_v2_db
    v2_mastery_cache = {}
    try:
        for course_dir in courses:
            v2_data = mastery_v2_db.compute_course_mastery(user_id, course_dir.name)
            v2_mastery_cache[course_dir.name] = v2_data.get("course_mastery_pct", 0.0)
    except Exception:
        pass  # V2 not available — fall back to legacy formula below

    for course_dir in courses:
        documents = [f for f in course_dir.iterdir() if f.is_file() and not f.name.endswith(".annotations.json")]
        total_docs += len(documents)
        
        # Use V2 mastery if available, else legacy formula
        v2_pct = v2_mastery_cache.get(course_dir.name)
        if v2_pct is not None and v2_pct > 0:
            mastery = round(v2_pct, 1)
            avg_quiz = None
        else:
            # Legacy fallback
            doc_score = min(len(documents) * 10, 100)
            q_results = activity.get("quiz_results", [])
            q_scores = [q.get("score", 0) for q in q_results if q.get("course_id") == course_dir.name]
            avg_quiz = sum(q_scores) / len(q_scores) if q_scores else 0
            mastery = (doc_score * 0.4) + (avg_quiz * 0.6) if q_scores else doc_score
            mastery = round(mastery, 1)
        
        # Get upload date from earliest file creation time
        upload_date = None
        if documents:
            try:
                earliest = min(documents, key=lambda f: f.stat().st_ctime)
                upload_date = datetime.fromtimestamp(earliest.stat().st_ctime).strftime("%b %d, %Y")
            except Exception:
                pass
        
        stats["courses"].append({
            "name": course_dir.name.replace("_", " ").title(),
            "id": course_dir.name,
            "document_count": len(documents),
            "documents": [f.name for f in documents],
            "mastery": mastery,
            "avg_quiz_score": round(avg_quiz, 1) if avg_quiz else None,
            "upload_date": upload_date,
        })
    stats["total_documents"] = total_docs

    return stats

def log_activity(user_id: str, activity_type: str, data: dict):
    """Log user activity with enhanced tracking"""
    user_upload_dir = Path(settings.UPLOAD_DIR) / user_id
    user_upload_dir.mkdir(parents=True, exist_ok=True)
    
    activity_file = user_upload_dir / "activity.json"
    
    # Load existing activity
    activity = {
        "questions": [],
        "quizzes_taken": 0,
        "study_hours": 0,
        "daily_activity": {},
        "last_updated": None
    }
    
    if activity_file.exists():
        try:
            with open(activity_file, 'r') as f:
                activity = json.load(f)
        except:
            pass
    
    # Get current date for daily tracking
    current_date = datetime.now().strftime("%Y-%m-%d")
    
    # Initialize daily activity if not exists
    if current_date not in activity.get("daily_activity", {}):
        activity.setdefault("daily_activity", {})[current_date] = {
            "questions": 0,
            "quizzes": 0,
            "study_time": 0,
            "documents_uploaded": 0,
            "flashcards": 0
        }
    
    # Ensure flashcards key exists on older records
    activity["daily_activity"][current_date].setdefault("flashcards", 0)
    
    # Update activity
    if activity_type == "question":
        activity["questions"].append({
            "question": data.get("question"),
            "course": data.get("course"),
            "timestamp": datetime.now().isoformat()
        })
        # Keep only last 50 questions
        activity["questions"] = activity["questions"][-50:]
        
        # Update daily activity
        activity["daily_activity"][current_date]["questions"] += 1
    
    elif activity_type == "quiz":
        activity["quizzes_taken"] = activity.get("quizzes_taken", 0) + 1
        activity["daily_activity"][current_date]["quizzes"] += 1
    
    elif activity_type == "quiz_completed":
        # Handle quiz completion
        activity["quizzes_taken"] = activity.get("quizzes_taken", 0) + 1
        activity["daily_activity"][current_date]["quizzes"] += 1
        
        # Track history of scores per course
        history = activity.setdefault("quiz_results", [])
        history.append({
            "course_id": data.get("course_id"),
            "score": data.get("score", 0),
            "timestamp": datetime.now().isoformat()
        })
        activity["quiz_results"] = history[-100:] # Keep last 100
    
    elif activity_type == "study_session":
        hours = data.get("hours", 0)
        activity["study_hours"] = activity.get("study_hours", 0) + hours
        activity["daily_activity"][current_date]["study_time"] += hours
    
    elif activity_type == "document_upload":
        activity["daily_activity"][current_date]["documents_uploaded"] += 1
    
    elif activity_type == "flashcard":
        activity["daily_activity"][current_date].setdefault("flashcards", 0)
        activity["daily_activity"][current_date]["flashcards"] += 1
    
    activity["last_updated"] = datetime.now().isoformat()
    
    # Save activity
    with open(activity_file, 'w') as f:
        json.dump(activity, f, indent=2)

@router.get("/stats")
async def get_stats(current_user: User = Depends(get_authenticated_user)):
    """Get user statistics"""
    try:
        user_id = str(current_user.id)
        stats = get_user_stats(user_id)
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/activity")
async def log_user_activity(
    activity_type: str, 
    data: dict,
    current_user: User = Depends(get_authenticated_user)
):
    """Log user activity"""
    try:
        user_id = str(current_user.id)
        log_activity(user_id, activity_type, data)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/courses")
async def get_user_courses(current_user: User = Depends(get_authenticated_user)):
    """Get all courses for a user"""
    try:
        user_id = str(current_user.id)
        stats = get_user_stats(user_id)
        return {"courses": stats["courses"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
def clear_course_activity(user_id: str, course_id: str):
    """Remove all activity records related to a specific course"""
    user_upload_dir = Path(settings.UPLOAD_DIR) / user_id
    activity_file = user_upload_dir / "activity.json"
    
    if not activity_file.exists():
        return
        
    try:
        with open(activity_file, 'r') as f:
            activity = json.load(f)
            
        # Clear quiz results for this course
        if "quiz_results" in activity:
            activity["quiz_results"] = [q for q in activity["quiz_results"] if q.get("course_id") != course_id]
            
        # Clear questions for this course
        if "questions" in activity:
            activity["questions"] = [q for q in activity["questions"] if q.get("course") != course_id]
            
        with open(activity_file, 'w') as f:
            json.dump(activity, f, indent=2)
            
    except Exception as e:
        print(f"Error clearing course activity: {e}")
