from fastapi import APIRouter, HTTPException, Depends, Request
from models.schemas import FlashcardRequest, FlashcardResponse
from services.flashcard_service import FlashcardService
from api.routes.auth import get_authenticated_user
from api.routes.stats import log_activity
from models.auth_models import User
from database.mastery_v2_db import mastery_v2_db
from pydantic import BaseModel
import traceback
from typing import Optional

router = APIRouter()
flashcard_service = FlashcardService()

class AuthenticatedFlashcardRequest(BaseModel):
    """Flashcard request without user_id (taken from authentication)"""
    course_id: str
    num_cards: int = 10
    include_images: bool = True
    explanation_level: str = "detailed"
    filename: Optional[str] = None
    topic: Optional[str] = None


class FlashcardRatingRequest(BaseModel):
    """Rating submitted when a student rates a flashcard"""
    course_id: str
    rating: str          # 'mastered' | 'familiar' | 'unfamiliar'
    concept: str         # concept label from the card (used as fallback)
    subtopic_id: Optional[str] = None   # V2 concept_id if available
    doc_id: Optional[str] = None        # V2 doc_id if available


@router.post("/generate", response_model=FlashcardResponse)
async def generate_flashcards(
    request: Request,
    payload: AuthenticatedFlashcardRequest,
    current_user: User = Depends(get_authenticated_user)
):
    """Generate flashcards from study materials"""
    try:
        user_id = str(current_user.id)
        api_key = getattr(request.state, "groq_api_key", None)
        
        flashcards = flashcard_service.generate_flashcards(
            user_id,
            payload.course_id,
            payload.num_cards,
            payload.include_images,
            payload.explanation_level,
            payload.filename,
            payload.topic,
            api_key=api_key
        )
        
        try:
            log_activity(user_id, "flashcard", {"course_id": payload.course_id, "num_cards": payload.num_cards})
        except:
            pass
        
        return FlashcardResponse(flashcards=flashcards)
    
    except ValueError as e:
        if "NO_DOCUMENTS" in str(e):
            raise HTTPException(400, "No documents uploaded yet. Go to Knowledge Base and upload a document to this course first.")
        raise HTTPException(400, str(e))
    except Exception as e:
        print(f"Error in generate_flashcards: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(500, f"Error generating flashcards: {str(e)}")


@router.post("/rate")
async def rate_flashcard(
    payload: FlashcardRatingRequest,
    current_user: User = Depends(get_authenticated_user)
):
    """
    Rate a flashcard (mastered / familiar / unfamiliar).

    If the card has a subtopic_id from the V2 concept graph, fires a mastery
    event through MasteryEngine and returns XP delta + course mastery update.
    Falls back to legacy mastery_db if no subtopic_id is provided.

    Response includes:
        xp_earned, mastery_delta, course_mastery_pct, concept_name — for XP toast
    """
    valid_ratings = {"mastered", "familiar", "unfamiliar"}
    if payload.rating not in valid_ratings:
        raise HTTPException(400, f"rating must be one of {valid_ratings}")

    user_id = str(current_user.id)

    # ── Resolve subtopic_id from concept name if not already tagged ──────────
    # Cards generated before extraction had no subtopic_id. At rating time we
    # try a name-match against the extracted concept graph so they still earn XP.
    resolved_subtopic_id = payload.subtopic_id
    resolved_doc_id      = payload.doc_id

    if (not resolved_subtopic_id or not resolved_doc_id) and payload.concept:
        try:
            import logging as _log
            _logger = _log.getLogger(__name__)
            subtopics = mastery_v2_db.get_subtopics_for_course(user_id, payload.course_id)
            _logger.info(f"[RateFlashcard] Concept match attempt: '{payload.concept}' against {len(subtopics)} subtopics")
            concept_lower = payload.concept.lower().strip()
            # Try progressively looser matches
            best = None
            for s in subtopics:
                name_lower = s["concept_name"].lower()
                # Exact
                if name_lower == concept_lower:
                    best = s
                    break
                # One fully contains the other
                if concept_lower in name_lower or name_lower in concept_lower:
                    best = s
                    break
                # Word-level overlap (at least one meaningful word in common)
                c_words = set(w for w in concept_lower.split() if len(w) > 3)
                n_words = set(w for w in name_lower.split() if len(w) > 3)
                if c_words and n_words and c_words & n_words:
                    if best is None:  # take first word-overlap match as fallback
                        best = s

            if best:
                resolved_subtopic_id = best["concept_id"]
                resolved_doc_id      = best["doc_id"]
                _logger.info(f"[RateFlashcard] Matched '{payload.concept}' → '{best['concept_name']}' (id={best['concept_id'][:8]})")
            else:
                _logger.warning(f"[RateFlashcard] No subtopic match for concept='{payload.concept}'. Available: {[s['concept_name'] for s in subtopics[:6]]}")
        except Exception as ex:
            import logging as _log
            _log.getLogger(__name__).error(f"[RateFlashcard] Name-match error: {ex}", exc_info=True)
    # ─────────────────────────────────────────────────────────────────────────

    # ── Mastery V2 path ──────────────────────────────────────────────────────
    if resolved_subtopic_id and resolved_doc_id:
        try:
            from services.mastery_engine import mastery_engine
            import logging as _log
            _log.getLogger(__name__).info(f"[RateFlashcard] Firing V2 event: {payload.rating} → subtopic={resolved_subtopic_id[:8]}")
            event_type = f"flashcard_{payload.rating}"
            result = mastery_engine.log_event(
                user_id=user_id,
                course_id=payload.course_id,
                doc_id=resolved_doc_id,
                concept_id=resolved_subtopic_id,
                event_type=event_type,
            )
            _log.getLogger(__name__).info(f"[RateFlashcard] XP awarded: {result['xp_earned']}, course mastery: {result['course_mastery_pct']:.1f}%")
            return {
                "status": "ok",
                "xp_earned": result["xp_earned"],
                "mastery_delta": result["mastery_delta"],
                "mastery_pct_after": result["mastery_pct_after"],
                "course_mastery_pct": result["course_mastery_pct"],
                "concept_name": result["concept_name"],
                "doc_filename": result["doc_filename"],
                "capped": result["capped"],
            }
        except Exception as e:
            import logging as _log
            _log.getLogger(__name__).error(f"[RateFlashcard] V2 mastery engine failed: {e}", exc_info=True)

    # ── Legacy fallback path (old mastery_db) ────────────────────────────────
    try:
        from database.mastery_db import mastery_db
        familiarity_map = {"mastered": 1, "familiar": 0, "unfamiliar": -1}
        familiarity = familiarity_map[payload.rating]
        mastery_db.update_mastery(
            user_id, payload.course_id, payload.concept, familiarity,
            action="flashcard_review"
        )
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Legacy mastery update failed: {e}")

    return {
        "status": "ok",
        "xp_earned": 0,
        "mastery_delta": 0,
        "mastery_pct_after": None,
        "course_mastery_pct": None,
        "concept_name": payload.concept,
        "doc_filename": None,
        "capped": False,
    }
