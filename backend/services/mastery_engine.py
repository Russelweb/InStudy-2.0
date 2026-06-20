"""
Mastery Engine — Phase 1, Tasks 1.5 + 1.6

The single entry point for ALL mastery-affecting actions across every tool.
No tool writes to mastery tables directly — everything flows through here.

Usage:
    from services.mastery_engine import mastery_engine

    result = mastery_engine.log_event(
        user_id="1",
        course_id="bio101",
        doc_id="<uuid>",
        concept_id="<subtopic_uuid>",
        event_type="quiz_correct",  
        tool="quiz",
        difficulty="hard",
    )
    # result = { "xp_earned": 25, "mastery_delta": 3.2, "course_mastery": 41.5,
    #            "concept_name": "Photosynthesis", "capped": False }

Event types:
    quiz_correct          quiz_incorrect
    flashcard_mastered    flashcard_familiar    flashcard_unfamiliar
    tutor_micro_correct   tutor_micro_skipped   tutor_micro_incorrect
    reading_page
"""

import logging
from typing import Optional, Dict, Any

from database.mastery_v2_db import mastery_v2_db

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# XP award table — (event_type, difficulty?) → base XP
# ---------------------------------------------------------------------------

XP_TABLE: Dict[str, Dict[str, int]] = {
    # Quiz
    "quiz_correct": {"easy": 10, "medium": 15, "hard": 25, "default": 15},
    "quiz_incorrect": {"default": 0},

    # Flashcards
    "flashcard_mastered":    {"default": 10},
    "flashcard_familiar":    {"default": 5},
    "flashcard_unfamiliar":  {"default": 0},

    # AI Tutor micro-assessment
    "tutor_micro_correct":   {"default": 12},
    "tutor_micro_skipped":   {"default": 5},
    "tutor_micro_incorrect": {"default": 0},

    # Document reading (per confirmed page)
    "reading_page": {"default": 2},
}

# ---------------------------------------------------------------------------
# Mastery score delta table — how much raw mastery % to adjust on event
# (independent of XP — XP drives long-term mastery, this drives immediate
#  responsiveness so quiz failure is visible right away)
# ---------------------------------------------------------------------------

MASTERY_DELTA_TABLE: Dict[str, float] = {
    "quiz_correct":          +3.0,
    "quiz_incorrect":        -5.0,   # strongest negative signal
    "flashcard_mastered":    +2.0,
    "flashcard_familiar":    +1.0,
    "flashcard_unfamiliar":  -1.5,
    "tutor_micro_correct":   +2.5,
    "tutor_micro_skipped":   +0.5,
    "tutor_micro_incorrect": -2.0,
    "reading_page":          +0.2,
}

# Tool mapping
TOOL_FOR_EVENT: Dict[str, str] = {
    "quiz_correct":          "quiz",
    "quiz_incorrect":        "quiz",
    "flashcard_mastered":    "flashcard",
    "flashcard_familiar":    "flashcard",
    "flashcard_unfamiliar":  "flashcard",
    "tutor_micro_correct":   "tutor",
    "tutor_micro_skipped":   "tutor",
    "tutor_micro_incorrect": "tutor",
    "reading_page":          "reading",
}


class MasteryEngine:
    """
    Central processor for all mastery events.

    Every call to log_event:
      1. Awards XP (respecting per-tool caps)
      2. Recomputes subtopic mastery %
      3. Applies immediate mastery delta (for negative signals like quiz failure)
      4. Logs the full event to mastery_events
      5. Returns a rich result dict for the API response
    """

    def log_event(
        self,
        user_id: str,
        course_id: str,
        doc_id: str,
        concept_id: str,
        event_type: str,
        difficulty: str = "medium",
        metadata: dict = None,
    ) -> Dict[str, Any]:
        """
        Process a mastery event and return the result.

        Returns:
            {
              "xp_earned": int,
              "mastery_pct_before": float,
              "mastery_pct_after": float,
              "mastery_delta": float,
              "course_mastery_pct": float,
              "concept_name": str,
              "doc_filename": str,
              "capped": bool,       # True if XP cap was reached for this tool
              "event_type": str,
            }
        """
        tool = TOOL_FOR_EVENT.get(event_type, "unknown")

        # ── 1. Determine XP to award ────────────────────────────────────────
        xp_rates = XP_TABLE.get(event_type, {"default": 0})
        base_xp = xp_rates.get(difficulty, xp_rates.get("default", 0))

        # ── 2. Get mastery before ────────────────────────────────────────────
        mastery_before = self._get_subtopic_mastery(user_id, course_id, concept_id)

        # ── 3. Record XP (enforces per-tool cap) ────────────────────────────
        xp_recorded = False
        actual_xp = 0
        capped = False

        if base_xp > 0:
            xp_recorded = mastery_v2_db.record_xp(
                user_id=user_id,
                course_id=course_id,
                doc_id=doc_id,
                concept_id=concept_id,
                tool=tool,
                xp_earned=base_xp,
                xp_source=f"{event_type}_{difficulty}" if difficulty else event_type,
            )
            if xp_recorded:
                actual_xp = base_xp
            else:
                capped = True

        # ── 4. Apply immediate mastery delta (negative events must show fast) ──
        immediate_delta = MASTERY_DELTA_TABLE.get(event_type, 0.0)
        if immediate_delta < 0:
            # Apply negative delta directly to stored mastery score
            self._apply_immediate_delta(
                user_id, course_id, doc_id, concept_id, immediate_delta
            )

        # ── 5. Recompute subtopic mastery from all XP ────────────────────────
        mastery_after = mastery_v2_db.compute_and_store_subtopic_mastery(
            user_id, course_id, doc_id, concept_id
        )

        mastery_delta = round(mastery_after - mastery_before, 2)

        # ── 6. Get course mastery snapshot ───────────────────────────────────
        course_data = mastery_v2_db.compute_course_mastery(user_id, course_id)
        course_mastery_pct = course_data["course_mastery_pct"]

        # ── 7. Get concept name + doc filename for response ──────────────────
        concept_name, doc_filename = self._get_concept_meta(
            user_id, course_id, doc_id, concept_id
        )

        # ── 8. Log the event ─────────────────────────────────────────────────
        mastery_v2_db.log_mastery_event(
            user_id=user_id,
            course_id=course_id,
            doc_id=doc_id,
            concept_id=concept_id,
            event_type=event_type,
            xp_delta=actual_xp,
            mastery_delta=mastery_delta,
            tool=tool,
            difficulty=difficulty,
            metadata=metadata,
        )

        logger.info(
            f"[MasteryEngine] {event_type} | user={user_id} | "
            f"concept='{concept_name}' | xp=+{actual_xp} | "
            f"mastery {mastery_before:.1f}%→{mastery_after:.1f}% | "
            f"course={course_mastery_pct:.1f}%"
            + (" [CAPPED]" if capped else "")
        )

        return {
            "xp_earned": actual_xp,
            "mastery_pct_before": mastery_before,
            "mastery_pct_after": mastery_after,
            "mastery_delta": mastery_delta,
            "course_mastery_pct": course_mastery_pct,
            "concept_name": concept_name,
            "doc_filename": doc_filename,
            "capped": capped,
            "event_type": event_type,
        }

    def log_quiz_batch(
        self,
        user_id: str,
        course_id: str,
        results: list,  # [{"doc_id", "concept_id", "correct": bool, "difficulty": str}]
    ) -> Dict[str, Any]:
        """
        Process a batch of quiz results (one full quiz session).
        Returns aggregate XP, course mastery after, and per-question results.
        """
        per_question = []
        total_xp = 0
        for r in results:
            event_type = "quiz_correct" if r.get("correct") else "quiz_incorrect"
            result = self.log_event(
                user_id=user_id,
                course_id=course_id,
                doc_id=r["doc_id"],
                concept_id=r["concept_id"],
                event_type=event_type,
                difficulty=r.get("difficulty", "medium"),
                metadata={"question_text": r.get("question_text", "")[:200]},
            )
            total_xp += result["xp_earned"]
            per_question.append(result)

        # Final course mastery after all events
        course_data = mastery_v2_db.compute_course_mastery(user_id, course_id)

        return {
            "total_xp": total_xp,
            "course_mastery_pct": course_data["course_mastery_pct"],
            "per_question": per_question,
        }

    def confirm_tutor_xp(
        self,
        user_id: str,
        session_id: str,
        outcome: str,  # 'correct' | 'incorrect' | 'skipped'
    ) -> Optional[Dict[str, Any]]:
        """
        Resolve a pending tutor micro-assessment and award final XP.
        Returns None if session_id not found or already resolved.
        """
        resolved = mastery_v2_db.resolve_pending_tutor_xp(user_id, session_id, outcome)
        if not resolved:
            logger.warning(f"[MasteryEngine] Pending session {session_id} not found or expired")
            return None

        final_xp = resolved["final_xp"]
        if final_xp <= 0:
            # Incorrect — no XP, but log negative mastery delta
            event_type = "tutor_micro_incorrect"
        elif outcome == "skipped":
            event_type = "tutor_micro_skipped"
        else:
            event_type = "tutor_micro_correct"

        # Award the final XP through the normal event pipeline
        result = self.log_event(
            user_id=user_id,
            course_id=resolved["course_id"],
            doc_id=resolved["doc_id"],
            concept_id=resolved["concept_id"],
            event_type=event_type,
            metadata={"session_id": session_id, "trajectory": resolved["trajectory"]},
        )

        # Override xp_earned with the pending-adjusted value (may differ from table)
        result["xp_earned"] = final_xp
        result["outcome"] = outcome
        result["assessment_question"] = resolved.get("assessment_question")
        return result

    # -----------------------------------------------------------------------
    # Internal helpers
    # -----------------------------------------------------------------------

    def _get_subtopic_mastery(self, user_id: str, course_id: str,
                               concept_id: str) -> float:
        """Get current mastery % for a subtopic (0.0 if not yet tracked)."""
        subtopics = mastery_v2_db.get_subtopics_for_course(user_id, course_id)
        for s in subtopics:
            if s["concept_id"] == concept_id:
                return float(s.get("mastery_pct") or 0.0)
        return 0.0

    def _apply_immediate_delta(self, user_id: str, course_id: str, doc_id: str,
                                concept_id: str, delta: float):
        """
        Directly adjust a subtopic's mastery_pct in concept_mastery_scores
        for immediate negative signal visibility (e.g. quiz failure).
        Clamps result to [0, 100].
        """
        import sqlite3
        db_path = mastery_v2_db.db_path
        try:
            with sqlite3.connect(db_path, timeout=10) as conn:
                conn.row_factory = sqlite3.Row
                row = conn.execute("""
                    SELECT mastery_pct FROM concept_mastery_scores
                    WHERE user_id=? AND course_id=? AND concept_id=?
                """, (user_id, course_id, concept_id)).fetchone()

                if row:
                    current = row["mastery_pct"]
                    new_pct = max(0.0, min(100.0, current + delta))
                    conn.execute("""
                        UPDATE concept_mastery_scores
                        SET mastery_pct=?, last_updated=CURRENT_TIMESTAMP
                        WHERE user_id=? AND course_id=? AND concept_id=?
                    """, (new_pct, user_id, course_id, concept_id))
                    conn.commit()
        except Exception as e:
            logger.error(f"[MasteryEngine] Immediate delta error: {e}")

    def _get_concept_meta(self, user_id: str, course_id: str,
                           doc_id: str, concept_id: str):
        """Return (concept_name, doc_filename) for response enrichment."""
        try:
            import sqlite3
            db_path = mastery_v2_db.db_path
            with sqlite3.connect(db_path, timeout=10) as conn:
                conn.row_factory = sqlite3.Row
                row = conn.execute("""
                    SELECT cc.concept_name, cd.filename
                    FROM course_concepts cc
                    JOIN course_documents cd
                      ON cc.doc_id = cd.doc_id AND cd.user_id = cc.user_id
                    WHERE cc.user_id=? AND cc.course_id=? AND cc.concept_id=?
                """, (user_id, course_id, concept_id)).fetchone()
                if row:
                    return row["concept_name"], row["filename"]
        except Exception:
            pass
        return "Unknown Concept", "Unknown Document"


# ---------------------------------------------------------------------------
# Global singleton
# ---------------------------------------------------------------------------
mastery_engine = MasteryEngine()
