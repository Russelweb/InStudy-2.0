"""
Mastery V2 API Routes — Phase 1, Tasks 1.7 + 1.8

Endpoints:
  GET  /mastery/v2/course-graph/{course_id}           — Full 4-tier hierarchy + mastery scores
  GET  /mastery/v2/document-graph/{course_id}/{doc_id}— Single document's concept tree
  GET  /mastery/v2/course-mastery/{course_id}         — Course + per-document mastery %
  GET  /mastery/v2/daily/{course_id}                  — Today's XP + mastery delta summary
  GET  /mastery/v2/daily-breakdown/{course_id}        — Per-subtopic today breakdown
  GET  /mastery/v2/xp-summary/{course_id}             — XP by tool by day (chart data)
  GET  /mastery/v2/stale/{course_id}                  — Subtopics needing review
  GET  /mastery/v2/weakest/{course_id}                — Adaptive priority subtopics
  GET  /mastery/v2/pending-assessments                — Pending micro-assessments for user
  POST /mastery/v2/micro-assessment/{session_id}      — Submit micro-assessment answer
  POST /mastery/v2/heartbeat                          — Log productive study time
  POST /mastery/v2/apply-decay/{course_id}            — Trigger forgetting curve decay
  POST /mastery/v2/reset/{course_id}                  — Hard reset course mastery
  GET  /mastery/v2/documents/{course_id}              — List course documents + extraction status
"""

import logging
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Request
from pydantic import BaseModel

from api.routes.auth import get_authenticated_user
from models.auth_models import User
from database.mastery_v2_db import mastery_v2_db
from services.mastery_engine import mastery_engine

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class MicroAssessmentRequest(BaseModel):
    outcome: str  # 'correct' | 'incorrect' | 'skipped'

class HeartbeatRequest(BaseModel):
    course_id: str
    tool: str                         # 'flashcard' | 'quiz' | 'tutor' | 'reading' | 'inspace'
    duration_seconds: int = 30
    doc_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers — build the nested tree response
# ---------------------------------------------------------------------------

def _build_course_tree(user_id: str, course_id: str) -> dict:
    """
    Build a fully-nested course → document → concept → subtopic tree
    with mastery scores at every level.
    """
    docs = mastery_v2_db.list_documents(user_id, course_id)
    course_data = mastery_v2_db.compute_course_mastery(user_id, course_id)

    doc_map = {d["doc_id"]: d for d in course_data["documents"]}
    all_nodes = mastery_v2_db.get_concept_graph(user_id, course_id)

    # Organise nodes by doc_id
    nodes_by_doc: dict = {}
    for n in all_nodes:
        nodes_by_doc.setdefault(n["doc_id"], []).append(n)

    document_trees = []
    for doc in docs:
        doc_id = doc["doc_id"]
        doc_nodes = nodes_by_doc.get(doc_id, [])

        # tier-2 concepts
        concepts_tier2 = [n for n in doc_nodes if n["tier"] == 2]
        # tier-3 subtopics indexed by parent
        subtopics_by_parent: dict = {}
        for n in doc_nodes:
            if n["tier"] == 3:
                subtopics_by_parent.setdefault(n["parent_concept_id"], []).append(n)

        concept_trees = []
        for c in concepts_tier2:
            subs = subtopics_by_parent.get(c["concept_id"], [])
            concept_mastery = mastery_v2_db.compute_concept_mastery(
                user_id, course_id, doc_id, c["concept_id"]
            )
            concept_trees.append({
                "concept_id": c["concept_id"],
                "concept_name": c["concept_name"],
                "weight": c["weight"],
                "mastery_pct": concept_mastery,
                "subtopics": [
                    {
                        "concept_id": s["concept_id"],
                        "concept_name": s["concept_name"],
                        "weight": s["weight"],
                        "mastery_pct": s.get("mastery_pct") or 0.0,
                        "total_xp": s.get("total_xp") or 0,
                        "flashcard_xp": s.get("flashcard_xp") or 0,
                        "quiz_xp": s.get("quiz_xp") or 0,
                        "tutor_xp": s.get("tutor_xp") or 0,
                        "xp_cap": 100,
                    }
                    for s in subs
                ],
            })

        doc_mastery = doc_map.get(doc_id, {}).get("mastery_pct", 0.0)
        document_trees.append({
            "doc_id": doc_id,
            "filename": doc["filename"],
            "display_name": doc.get("display_name", doc["filename"]),
            "extraction_status": doc["extraction_status"],
            "document_weight": doc["document_weight"],
            "mastery_pct": doc_mastery,
            "concepts": concept_trees,
        })

    return {
        "course_id": course_id,
        "course_mastery_pct": course_data["course_mastery_pct"],
        "documents": document_trees,
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/course-graph/{course_id}")
async def get_course_graph(
    course_id: str,
    current_user: User = Depends(get_authenticated_user),
):
    """
    Full 4-tier hierarchy: Course → Document → Concept → Subtopic
    with mastery % at every level. Used by the Mastery page tree UI.
    """
    try:
        tree = _build_course_tree(str(current_user.id), course_id)
        return tree
    except Exception as e:
        logger.error(f"course-graph error: {e}")
        raise HTTPException(500, str(e))


@router.get("/document-graph/{course_id}/{doc_id}")
async def get_document_graph(
    course_id: str,
    doc_id: str,
    current_user: User = Depends(get_authenticated_user),
):
    """Concept tree for a single document with mastery scores."""
    try:
        user_id = str(current_user.id)
        doc = mastery_v2_db.get_document(user_id, course_id, doc_id)
        if not doc:
            raise HTTPException(404, "Document not found")

        nodes = mastery_v2_db.get_document_concept_graph(user_id, course_id, doc_id)
        concepts_tier2 = [n for n in nodes if n["tier"] == 2]
        subtopics_by_parent: dict = {}
        for n in nodes:
            if n["tier"] == 3:
                subtopics_by_parent.setdefault(n["parent_concept_id"], []).append(n)

        concept_trees = []
        for c in concepts_tier2:
            subs = subtopics_by_parent.get(c["concept_id"], [])
            concept_mastery = mastery_v2_db.compute_concept_mastery(
                user_id, course_id, doc_id, c["concept_id"]
            )
            concept_trees.append({
                "concept_id": c["concept_id"],
                "concept_name": c["concept_name"],
                "weight": c["weight"],
                "mastery_pct": concept_mastery,
                "subtopics": [
                    {
                        "concept_id": s["concept_id"],
                        "concept_name": s["concept_name"],
                        "weight": s["weight"],
                        "mastery_pct": s.get("mastery_pct") or 0.0,
                        "total_xp": s.get("total_xp") or 0,
                        "xp_cap": 100,
                    }
                    for s in subs
                ],
            })

        doc_mastery = mastery_v2_db.compute_document_mastery(user_id, course_id, doc_id)
        return {
            "doc_id": doc_id,
            "filename": doc["filename"],
            "extraction_status": doc["extraction_status"],
            "document_weight": doc["document_weight"],
            "mastery_pct": doc_mastery,
            "concepts": concept_trees,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"document-graph error: {e}")
        raise HTTPException(500, str(e))


@router.get("/course-mastery/{course_id}")
async def get_course_mastery(
    course_id: str,
    current_user: User = Depends(get_authenticated_user),
):
    """
    Quick course + per-document mastery summary (no full tree).
    Used by Dashboard cards and course cards.
    """
    try:
        data = mastery_v2_db.compute_course_mastery(str(current_user.id), course_id)
        return data
    except Exception as e:
        logger.error(f"course-mastery error: {e}")
        raise HTTPException(500, str(e))


@router.get("/daily/{course_id}")
async def get_daily_summary(
    course_id: str,
    date: Optional[str] = None,
    current_user: User = Depends(get_authenticated_user),
):
    """
    Today's XP earned, mastery % gained, and top concepts moved.
    Optionally pass ?date=YYYY-MM-DD for historical days.
    """
    try:
        user_id = str(current_user.id)
        summary = mastery_v2_db.get_daily_mastery_summary(user_id, course_id, date)
        study_time = mastery_v2_db.get_daily_study_time(user_id, course_id, date)
        return {**summary, "study_time": study_time}
    except Exception as e:
        logger.error(f"daily summary error: {e}")
        raise HTTPException(500, str(e))


@router.get("/daily-breakdown/{course_id}")
async def get_daily_breakdown(
    course_id: str,
    date: Optional[str] = None,
    current_user: User = Depends(get_authenticated_user),
):
    """
    Per-subtopic detail for today: which subtopics earned XP,
    from which tool, and what the delta was.
    """
    try:
        user_id = str(current_user.id)
        if not date:
            from datetime import datetime
            date = datetime.now().strftime("%Y-%m-%d")

        import sqlite3
        db_path = mastery_v2_db.db_path
        with sqlite3.connect(db_path, timeout=10) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute("""
                SELECT me.concept_id, cc.concept_name, cc.weight,
                       p_cc.concept_name as parent_concept_name,
                       cd.filename, me.doc_id,
                       SUM(me.xp_delta) as xp_today,
                       SUM(me.mastery_delta) as mastery_delta_today,
                       GROUP_CONCAT(DISTINCT me.tool) as tools_used,
                       GROUP_CONCAT(DISTINCT me.event_type) as event_types
                FROM mastery_events me
                JOIN course_concepts cc ON me.concept_id = cc.concept_id
                LEFT JOIN course_concepts p_cc ON cc.parent_concept_id = p_cc.concept_id
                JOIN course_documents cd ON me.doc_id = cd.doc_id
                WHERE me.user_id=? AND me.course_id=? AND DATE(me.created_at)=?
                GROUP BY me.concept_id
                ORDER BY xp_today DESC
            """, (user_id, course_id, date)).fetchall()

        return {
            "date": date,
            "subtopics": [dict(r) for r in rows],
        }
    except Exception as e:
        logger.error(f"daily-breakdown error: {e}")
        raise HTTPException(500, str(e))


@router.get("/xp-summary/{course_id}")
async def get_xp_summary(
    course_id: str,
    days: int = 30,
    current_user: User = Depends(get_authenticated_user),
):
    """XP by tool and by day for the last N days. Used for charts."""
    try:
        data = mastery_v2_db.get_xp_summary(str(current_user.id), course_id, days)
        return {"course_id": course_id, "days": days, "data": data}
    except Exception as e:
        logger.error(f"xp-summary error: {e}")
        raise HTTPException(500, str(e))


@router.get("/stale/{course_id}")
async def get_stale_subtopics(
    course_id: str,
    days: int = 14,
    current_user: User = Depends(get_authenticated_user),
):
    """Subtopics not interacted with for >= N days. Includes predicted decay."""
    try:
        stale = mastery_v2_db.get_stale_subtopics(str(current_user.id), course_id, days)
        return {"course_id": course_id, "threshold_days": days, "stale_subtopics": stale}
    except Exception as e:
        logger.error(f"stale error: {e}")
        raise HTTPException(500, str(e))


@router.get("/weakest/{course_id}")
async def get_weakest_subtopics(
    course_id: str,
    limit: int = 20,
    doc_id: Optional[str] = None,
    current_user: User = Depends(get_authenticated_user),
):
    """
    Adaptive priority list — weakest/never-studied subtopics first.
    Used by flashcard and quiz generation for adaptive ordering.
    Optionally filter to a single document with ?doc_id=<uuid>.
    """
    try:
        subtopics = mastery_v2_db.get_weakest_subtopics(
            str(current_user.id), course_id, limit=limit, doc_id=doc_id
        )
        return {"course_id": course_id, "subtopics": subtopics}
    except Exception as e:
        logger.error(f"weakest error: {e}")
        raise HTTPException(500, str(e))


@router.get("/pending-assessments")
async def get_pending_assessments(
    current_user: User = Depends(get_authenticated_user),
):
    """All active pending micro-assessments for the current user."""
    try:
        assessments = mastery_v2_db.get_user_pending_assessments(str(current_user.id))
        return {"pending_assessments": assessments}
    except Exception as e:
        logger.error(f"pending-assessments error: {e}")
        raise HTTPException(500, str(e))


@router.post("/micro-assessment/{session_id}")
async def submit_micro_assessment(
    session_id: str,
    request: MicroAssessmentRequest,
    current_user: User = Depends(get_authenticated_user),
):
    """
    Submit a micro-assessment answer to confirm/deny pending tutor XP.
    outcome: 'correct' | 'incorrect' | 'skipped'
    """
    valid_outcomes = {"correct", "incorrect", "skipped"}
    if request.outcome not in valid_outcomes:
        raise HTTPException(400, f"outcome must be one of {valid_outcomes}")
    try:
        result = mastery_engine.confirm_tutor_xp(
            user_id=str(current_user.id),
            session_id=session_id,
            outcome=request.outcome,
        )
        if not result:
            raise HTTPException(404, "Assessment session not found or already completed")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"micro-assessment error: {e}")
        raise HTTPException(500, str(e))


@router.post("/heartbeat")
async def log_heartbeat(
    request: HeartbeatRequest,
    current_user: User = Depends(get_authenticated_user),
):
    """Log a productive study heartbeat (30s of active interaction)."""
    valid_tools = {"flashcard", "quiz", "tutor", "reading", "inspace", "workspace"}
    if request.tool not in valid_tools:
        raise HTTPException(400, f"tool must be one of {valid_tools}")
    if request.duration_seconds < 0 or request.duration_seconds > 300:
        raise HTTPException(400, "duration_seconds must be between 0 and 300")
    try:
        mastery_v2_db.log_heartbeat(
            user_id=str(current_user.id),
            course_id=request.course_id,
            tool=request.tool,
            duration_seconds=request.duration_seconds,
            doc_id=request.doc_id,
        )
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"heartbeat error: {e}")
        raise HTTPException(500, str(e))


@router.post("/apply-decay/{course_id}")
async def apply_decay(
    course_id: str,
    current_user: User = Depends(get_authenticated_user),
):
    """Trigger forgetting curve decay for all subtopics in a course."""
    try:
        updated = mastery_v2_db.apply_decay_to_course(str(current_user.id), course_id)
        return {
            "course_id": course_id,
            "subtopics_updated": updated,
            "message": f"Decay applied to {updated} subtopics",
        }
    except Exception as e:
        logger.error(f"apply-decay error: {e}")
        raise HTTPException(500, str(e))


@router.post("/reset/{course_id}")
async def reset_mastery(
    course_id: str,
    current_user: User = Depends(get_authenticated_user),
):
    """Hard reset — clears all XP, mastery scores, events, and study sessions for a course."""
    try:
        success = mastery_v2_db.reset_course_mastery(str(current_user.id), course_id)
        if not success:
            raise HTTPException(500, "Reset failed")
        return {"status": "success", "message": "Course mastery has been reset"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"reset error: {e}")
        raise HTTPException(500, str(e))


@router.get("/documents/{course_id}")
async def list_course_documents(
    course_id: str,
    current_user: User = Depends(get_authenticated_user),
):
    """
    List all registered documents for a course with their extraction status
    and document weight. Useful for showing extraction progress in the UI.
    """
    try:
        docs = mastery_v2_db.list_documents(str(current_user.id), course_id)
        return {"course_id": course_id, "documents": docs}
    except Exception as e:
        logger.error(f"list documents error: {e}")
        raise HTTPException(500, str(e))


@router.post("/trigger-extraction/{course_id}")
async def trigger_extraction(
    course_id: str,
    background_tasks: BackgroundTasks,
    request: Request,
    current_user: User = Depends(get_authenticated_user),
):
    """
    Manually trigger concept extraction for all documents in a course
    that haven't been extracted yet (status = pending or failed).
    Useful when a course existed before the V2 system was deployed.
    """
    from services.document_processor import DocumentProcessor
    from services.concept_extraction import extract_and_store_concepts
    from utils.file_utils import get_user_course_dir
    from pathlib import Path
    import os

    user_id = str(current_user.id)
    api_key = getattr(request.state, "groq_api_key", None)

    try:
        user_course_dir = Path(get_user_course_dir(user_id, course_id))
        if not user_course_dir.exists():
            return {"message": "No documents found for this course", "queued": 0}

        doc_processor = DocumentProcessor()
        queued = 0

        for fname in os.listdir(user_course_dir):
            if fname.endswith('.annotations.json'):
                continue
            # Skip image files — they have no extractable text concepts
            if fname.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp')):
                continue

            # Register document if not already registered
            doc_id = mastery_v2_db.register_document(user_id, course_id, fname)
            doc = mastery_v2_db.get_document(user_id, course_id, doc_id)

            # Only extract if pending or failed
            if doc and doc.get('extraction_status') in ('pending', 'failed', None):
                file_path = str(user_course_dir / fname)

                async def _extract(fp=file_path, fn=fname, did=doc_id):
                    try:
                        text = doc_processor.extract_text(fp)
                        if text and text.strip():
                            await extract_and_store_concepts(
                                user_id=user_id,
                                course_id=course_id,
                                doc_id=did,
                                filename=fn,
                                document_text=text,
                                api_key=api_key,
                            )
                    except Exception as ex:
                        logger.error(f"Manual extraction failed for {fn}: {ex}")
                        mastery_v2_db.set_extraction_status(user_id, course_id, did, "failed")

                background_tasks.add_task(_extract)
                queued += 1

        return {
            "message": f"Queued concept extraction for {queued} document(s). Check back in ~30s.",
            "queued": queued,
        }
    except Exception as e:
        logger.error(f"trigger-extraction error: {e}")
        raise HTTPException(500, str(e))
