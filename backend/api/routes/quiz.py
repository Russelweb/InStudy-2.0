from fastapi import APIRouter, HTTPException, Depends, Request
from models.schemas import QuizRequest, QuizResponse
from services.quiz_service import QuizService
from api.routes.stats import log_activity
from api.routes.auth import get_authenticated_user
from services.auth_service import auth_service
from models.auth_models import User
from pydantic import BaseModel
from typing import Dict, List, Any, Optional
import traceback

router = APIRouter()
quiz_service = QuizService()

class AuthenticatedQuizRequest(BaseModel):
    """Quiz request without user_id (taken from authentication)"""
    course_id: str
    num_questions: int = 5
    difficulty: str = "medium"
    quiz_type: str = "multiple_choice"
    topic: Optional[str] = None  # Specific topic focus (e.g., "k-nearest neighbors")

class QuizEvaluationRequest(BaseModel):
    """Quiz evaluation request"""
    course_id: str
    questions: List[Dict[str, Any]]
    user_answers: Dict[str, str]
    difficulty: str = "medium"    # passed through for mastery XP calculation

class QuizEvaluationResponse(BaseModel):
    """Quiz evaluation response"""
    total_questions: int
    correct_answers: int
    score_percentage: float
    question_results: List[Dict[str, Any]]
    mastery_update: Optional[Dict[str, Any]] = None  # V2 XP data for frontend toast

def get_user_from_request(request: Request) -> Optional[User]:
    """Extract and verify user from request"""
    try:
        # Try to get from request state (set by middleware)
        if hasattr(request.state, 'user'):
            return request.state.user
        
        # Try HttpOnly cookie first
        token = request.cookies.get("session_token")
        
        # Fallback to Authorization header
        if not token:
            auth_header = request.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header[7:]
        
        # Fallback to X-Auth-Token header
        if not token:
            token = request.headers.get("X-Auth-Token")
            
        if token:
            return auth_service.get_current_user(token)
        
        return None
    except Exception as e:
        print(f"Error extracting user from request: {e}")
        return None

@router.post("/generate", response_model=QuizResponse)
async def generate_quiz(
    request: Request,
    payload: AuthenticatedQuizRequest
):
    """Generate quiz from study materials"""
    try:
        # Get user manually
        current_user = get_user_from_request(request)
        if not current_user:
            raise HTTPException(401, "Authentication required")
        
        user_id = str(current_user.id)
        api_key = getattr(request.state, "groq_api_key", None)
        
        questions = quiz_service.generate_quiz(
            user_id,
            payload.course_id,
            payload.num_questions,
            payload.difficulty,
            payload.quiz_type,
            payload.topic,
            api_key=api_key
        )
        
        # Log quiz generation
        try:
            log_activity(user_id, "quiz", {})
        except:
            pass  # Don't fail if logging fails
        
        return QuizResponse(questions=questions)
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in generate_quiz: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(500, f"Error generating quiz: {str(e)}")

@router.post("/evaluate", response_model=QuizEvaluationResponse)
async def evaluate_quiz(
    request_data: QuizEvaluationRequest,
    request: Request
):
    """Evaluate quiz answers with semantic understanding"""
    print("=" * 50)
    print("QUIZ EVALUATION ENDPOINT CALLED")
    print("=" * 50)
    
    try:
        print("Step 1: Extracting user from request...")
        
        # Get user manually
        current_user = get_user_from_request(request)
        
        print(f"Step 2: User extracted: {current_user}")
        
        if not current_user:
            print("ERROR: No user found in request")
            raise HTTPException(401, "Authentication required")
        
        user_id = str(current_user.id)
        print(f"Step 3: User ID: {user_id}")
        
        print(f"Step 4: Number of questions: {len(request_data.questions)}")
        print(f"Step 5: Number of answers: {len(request_data.user_answers)}")
        
        # Evaluate the quiz
        print("Step 6: Starting quiz evaluation...")
        results = quiz_service.evaluate_quiz(
            request_data.questions,
            request_data.user_answers
        )
        
        print(f"Step 7: Evaluation complete - {results['correct_answers']}/{results['total_questions']} ({results['score_percentage']}%)")
        
        # Log quiz completion and update mastery
        print("Step 8: Logging activity and updating mastery...")
        mastery_result = None
        try:
            log_activity(user_id, "quiz_completed", {
                "course_id": request_data.course_id,
                "score": results["score_percentage"],
                "total_questions": results["total_questions"],
                "correct_answers": results["correct_answers"]
            })

            # ── Mastery V2: batch event through MasteryEngine ────────────────
            # Load all subtopics once for name-matching (handles pre-extraction questions)
            from database.mastery_v2_db import mastery_v2_db as mv2
            all_subtopics = mv2.get_subtopics_for_course(user_id, request_data.course_id)
            subtopic_by_name = {}
            for s in all_subtopics:
                subtopic_by_name[s["concept_name"].lower()] = s

            print(f"Step 8a: Loaded {len(all_subtopics)} subtopics for course {request_data.course_id}")

            def _resolve_subtopic(q_result, question_list):
                """Resolve subtopic_id + doc_id for a question result."""
                # 1. Try explicit tag on result
                sid = q_result.get("subtopic_id")
                did = q_result.get("doc_id")
                if sid and did:
                    return sid, did
                # 2. Try explicit tag on original question
                matched_q = next(
                    (q for q in question_list if q.get("question") == q_result.get("question")), None
                )
                if matched_q:
                    sid = matched_q.get("subtopic_id")
                    did = matched_q.get("doc_id")
                    if sid and did:
                        return sid, did
                # 3. Name-match via concept label
                concept = (q_result.get("concept") or "").lower().strip()
                if not concept or not subtopic_by_name:
                    return None, None

                # Exact match
                if concept in subtopic_by_name:
                    s = subtopic_by_name[concept]
                    return s["concept_id"], s["doc_id"]

                # Substring match
                for name, s in subtopic_by_name.items():
                    if concept in name or name in concept:
                        return s["concept_id"], s["doc_id"]

                # Word-level overlap (at least one meaningful word in common)
                c_words = set(w for w in concept.split() if len(w) > 3)
                if c_words:
                    for name, s in subtopic_by_name.items():
                        n_words = set(w for w in name.split() if len(w) > 3)
                        if c_words & n_words:
                            return s["concept_id"], s["doc_id"]

                return None, None

            v2_events = []
            for idx, q_res in enumerate(results["question_results"]):
                # Get concept from the ORIGINAL question by index (q_res may not have it)
                original_q = request_data.questions[idx] if idx < len(request_data.questions) else {}
                concept_label = (
                    q_res.get("concept")
                    or original_q.get("concept")
                    or ""
                )
                # Fix: None or "None" string → empty
                if not concept_label or str(concept_label).lower() in ("none", "null", ""):
                    concept_label = ""

                # Also check subtopic tags from original question
                q_res["concept"] = concept_label  # ensure result has it too

                subtopic_id, doc_id = _resolve_subtopic(
                    {**q_res, "concept": concept_label},
                    request_data.questions
                )
                if subtopic_id and doc_id:
                    print(f"Step 8b: Matched concept='{concept_label}' → subtopic={subtopic_id[:8]}")
                    v2_events.append({
                        "doc_id": doc_id,
                        "concept_id": subtopic_id,
                        "correct": q_res.get("is_correct", False),
                        "difficulty": request_data.difficulty if hasattr(request_data, "difficulty") else "medium",
                        "question_text": q_res.get("question", "")[:200],
                    })
                else:
                    print(f"Step 8b: No match for concept='{concept_label}' (available: {list(subtopic_by_name.keys())[:4]})")

            if v2_events:
                from services.mastery_engine import mastery_engine
                mastery_result = mastery_engine.log_quiz_batch(
                    user_id=user_id,
                    course_id=request_data.course_id,
                    results=v2_events,
                )
                print(f"Step 8a: V2 mastery updated — +{mastery_result['total_xp']} XP, "
                      f"course={mastery_result['course_mastery_pct']:.1f}%")
            else:
                # ── Legacy fallback ──────────────────────────────────────────
                from database.mastery_db import mastery_db
                for q_res in results["question_results"]:
                    concept = q_res.get("concept")
                    is_correct = q_res.get("is_correct")
                    q_type = q_res.get("type", "multiple_choice")
                    if concept:
                        if q_type in ["short_answer", "structural"]:
                            familiarity_delta = 0.5 if is_correct else -0.7
                        else:
                            familiarity_delta = 0.4 if is_correct else -0.6
                        mastery_db.update_mastery(
                            user_id, request_data.course_id, concept,
                            familiarity_delta, action='quiz_answer'
                        )
            # ─────────────────────────────────────────────────────────────────

            print("Step 9: Activity and mastery logged successfully")
        except Exception as log_error:
            print(f"Step 9: Failed to log activity/mastery (non-critical): {log_error}")

        # Attach mastery result to response for frontend XP toast
        response_data = results.copy()
        if mastery_result:
            response_data["mastery_update"] = {
                "total_xp": mastery_result["total_xp"],
                "course_mastery_pct": mastery_result["course_mastery_pct"],
            }
        else:
            response_data["mastery_update"] = None

        print("Step 10: Returning results...")
        print("=" * 50)
        return QuizEvaluationResponse(**response_data)
    
    except HTTPException as he:
        print(f"HTTPException raised: {he.status_code} - {he.detail}")
        raise
    except Exception as e:
        print(f"CRITICAL ERROR in evaluate_quiz: {str(e)}")
        print(traceback.format_exc())
        print("=" * 50)
        raise HTTPException(500, f"Error evaluating quiz: {str(e)}")
