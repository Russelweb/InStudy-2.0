"""
Mastery V2 Database — 4-tier hierarchical mastery tracking.

Hierarchy: Course → Document → Concept → Subtopic
XP accumulates at subtopic level and rolls upward through all 4 tiers.

Tables:
  1. course_documents      — document registry, extraction status, computed weight
  2. course_concepts       — 4-tier concept graph (tier 2 = concept, tier 3 = subtopic)
  3. concept_xp            — XP earned per subtopic per tool per event
  4. concept_mastery_scores— computed mastery % per subtopic (cached, recomputed on event)
  5. mastery_events        — full audit log of every mastery-affecting action
  6. pending_tutor_xp      — unconfirmed XP from AI Tutor sessions awaiting micro-assessment
  7. study_sessions        — productive study time (heartbeat-based, not time-on-page)
"""

import sqlite3
import uuid
import json
import math
import logging
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Forgetting curve constants
# ---------------------------------------------------------------------------
FORGETTING_STRENGTH_BASE = 7.0   # days — base memory strength
FORGETTING_MIN_FLOOR = -0.8      # floor so score never hits absolute zero

# ---------------------------------------------------------------------------
# XP caps per tool per subtopic
# ---------------------------------------------------------------------------
XP_CAP_FLASHCARD = 30
XP_CAP_QUIZ = 40
XP_CAP_TUTOR = 30
XP_CAP_READING = 10   # low cap — reading alone can't master a subtopic
XP_CAP_TOTAL = 100    # sum of all tool caps per subtopic

# ---------------------------------------------------------------------------
# Weight multipliers for concept classification
# ---------------------------------------------------------------------------
WEIGHT_VALUES = {"core": 3, "supporting": 2, "peripheral": 1}


class MasteryV2Database:
    def __init__(self, db_path: str = "backend/mastery_v2.db"):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(exist_ok=True)
        self._init_database()

    # -----------------------------------------------------------------------
    # Schema initialisation
    # -----------------------------------------------------------------------

    def _init_database(self):
        """Create all 7 tables and indexes if they don't exist."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("PRAGMA journal_mode=WAL")  # better concurrent access

            # 1. Document registry
            conn.execute("""
                CREATE TABLE IF NOT EXISTS course_documents (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    course_id TEXT NOT NULL,
                    doc_id TEXT NOT NULL,
                    filename TEXT NOT NULL,
                    display_name TEXT,
                    document_weight REAL DEFAULT 1.0,
                    extraction_status TEXT DEFAULT 'pending',
                    extracted_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, course_id, doc_id)
                )
            """)

            # 2. Concept graph (tier 2 = concept, tier 3 = subtopic)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS course_concepts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    course_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    doc_id TEXT NOT NULL,
                    concept_id TEXT NOT NULL,
                    concept_name TEXT NOT NULL,
                    parent_concept_id TEXT,
                    tier INTEGER NOT NULL,
                    weight TEXT DEFAULT 'supporting',
                    xp_cap INTEGER DEFAULT 100,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(course_id, user_id, doc_id, concept_id)
                )
            """)

            # 3. XP earned per subtopic per event
            conn.execute("""
                CREATE TABLE IF NOT EXISTS concept_xp (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    course_id TEXT NOT NULL,
                    doc_id TEXT NOT NULL,
                    concept_id TEXT NOT NULL,
                    tool TEXT NOT NULL,
                    xp_earned INTEGER NOT NULL,
                    xp_source TEXT,
                    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # 4. Computed mastery scores per subtopic (cache layer)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS concept_mastery_scores (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    course_id TEXT NOT NULL,
                    doc_id TEXT NOT NULL,
                    concept_id TEXT NOT NULL,
                    mastery_pct REAL DEFAULT 0.0,
                    total_xp INTEGER DEFAULT 0,
                    flashcard_xp INTEGER DEFAULT 0,
                    quiz_xp INTEGER DEFAULT 0,
                    tutor_xp INTEGER DEFAULT 0,
                    reading_xp INTEGER DEFAULT 0,
                    last_interaction TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, course_id, doc_id, concept_id)
                )
            """)

            # 5. Full event audit log
            conn.execute("""
                CREATE TABLE IF NOT EXISTS mastery_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    course_id TEXT NOT NULL,
                    doc_id TEXT NOT NULL,
                    concept_id TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    xp_delta INTEGER DEFAULT 0,
                    mastery_delta REAL DEFAULT 0.0,
                    course_mastery_after REAL,
                    tool TEXT NOT NULL,
                    difficulty TEXT,
                    metadata TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # 6. Pending tutor XP awaiting micro-assessment
            conn.execute("""
                CREATE TABLE IF NOT EXISTS pending_tutor_xp (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    course_id TEXT NOT NULL,
                    doc_id TEXT NOT NULL,
                    concept_id TEXT NOT NULL,
                    session_id TEXT NOT NULL,
                    pending_xp INTEGER NOT NULL,
                    trajectory TEXT NOT NULL,
                    assessment_question TEXT,
                    assessment_answer TEXT,
                    status TEXT DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP,
                    UNIQUE(user_id, session_id)
                )
            """)

            # 7. Productive study time (heartbeat-based)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS study_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    course_id TEXT NOT NULL,
                    doc_id TEXT,
                    tool TEXT NOT NULL,
                    productive_seconds INTEGER DEFAULT 0,
                    session_date DATE DEFAULT (DATE('now')),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Indexes
            for sql in [
                "CREATE INDEX IF NOT EXISTS idx_cd_user_course ON course_documents(user_id, course_id)",
                "CREATE INDEX IF NOT EXISTS idx_cc_user_course_doc ON course_concepts(user_id, course_id, doc_id)",
                "CREATE INDEX IF NOT EXISTS idx_cc_parent ON course_concepts(parent_concept_id)",
                "CREATE INDEX IF NOT EXISTS idx_xp_user_course ON concept_xp(user_id, course_id, concept_id)",
                "CREATE INDEX IF NOT EXISTS idx_xp_earned_at ON concept_xp(earned_at)",
                "CREATE INDEX IF NOT EXISTS idx_cms_user_course ON concept_mastery_scores(user_id, course_id)",
                "CREATE INDEX IF NOT EXISTS idx_events_user_course ON mastery_events(user_id, course_id)",
                "CREATE INDEX IF NOT EXISTS idx_events_created_at ON mastery_events(created_at)",
                "CREATE INDEX IF NOT EXISTS idx_pending_user ON pending_tutor_xp(user_id, status)",
                "CREATE INDEX IF NOT EXISTS idx_sessions_user_date ON study_sessions(user_id, course_id, session_date)",
            ]:
                conn.execute(sql)

            conn.commit()
            logger.info("MasteryV2 database initialised successfully")

    # -----------------------------------------------------------------------
    # Document registration
    # -----------------------------------------------------------------------

    def register_document(self, user_id: str, course_id: str, filename: str,
                           display_name: str = None) -> str:
        """
        Register an uploaded document. Returns the doc_id (UUID).
        If the same filename already exists for this user/course, returns the
        existing doc_id (idempotent — safe to call on re-upload).
        """
        with sqlite3.connect(self.db_path, timeout=10) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute(
                "SELECT doc_id FROM course_documents WHERE user_id=? AND course_id=? AND filename=?",
                (user_id, course_id, filename)
            ).fetchone()
            if row:
                return row["doc_id"]

            doc_id = str(uuid.uuid4())
            conn.execute("""
                INSERT INTO course_documents
                  (user_id, course_id, doc_id, filename, display_name, extraction_status)
                VALUES (?, ?, ?, ?, ?, 'pending')
            """, (user_id, course_id, doc_id, filename, display_name or filename))
            conn.commit()
            logger.info(f"Document registered: {filename} → doc_id={doc_id}")
            return doc_id

    def set_extraction_status(self, user_id: str, course_id: str, doc_id: str,
                               status: str, document_weight: float = None):
        """Update extraction status. Pass document_weight when status='complete'."""
        with sqlite3.connect(self.db_path, timeout=10) as conn:
            if document_weight is not None:
                conn.execute("""
                    UPDATE course_documents
                    SET extraction_status=?, document_weight=?, extracted_at=CURRENT_TIMESTAMP
                    WHERE user_id=? AND course_id=? AND doc_id=?
                """, (status, document_weight, user_id, course_id, doc_id))
            else:
                conn.execute("""
                    UPDATE course_documents
                    SET extraction_status=?
                    WHERE user_id=? AND course_id=? AND doc_id=?
                """, (status, user_id, course_id, doc_id))
            conn.commit()

    def get_document(self, user_id: str, course_id: str, doc_id: str) -> Optional[Dict]:
        with sqlite3.connect(self.db_path, timeout=10) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute(
                "SELECT * FROM course_documents WHERE user_id=? AND course_id=? AND doc_id=?",
                (user_id, course_id, doc_id)
            ).fetchone()
            return dict(row) if row else None

    def get_doc_id_by_filename(self, user_id: str, course_id: str, filename: str) -> Optional[str]:
        with sqlite3.connect(self.db_path, timeout=10) as conn:
            row = conn.execute(
                "SELECT doc_id FROM course_documents WHERE user_id=? AND course_id=? AND filename=?",
                (user_id, course_id, filename)
            ).fetchone()
            return row[0] if row else None

    def list_documents(self, user_id: str, course_id: str) -> List[Dict]:
        with sqlite3.connect(self.db_path, timeout=10) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                "SELECT * FROM course_documents WHERE user_id=? AND course_id=? ORDER BY created_at ASC",
                (user_id, course_id)
            ).fetchall()
            return [dict(r) for r in rows]

    # -----------------------------------------------------------------------
    # Concept graph — insert / query
    # -----------------------------------------------------------------------

    def insert_concept(self, user_id: str, course_id: str, doc_id: str,
                       concept_name: str, tier: int, weight: str,
                       parent_concept_id: str = None) -> str:
        """
        Insert a concept or subtopic node. Returns the concept_id (UUID).
        If an identical (user, course, doc, name, tier) already exists,
        returns the existing concept_id — safe to call on re-extraction.
        """
        with sqlite3.connect(self.db_path, timeout=10) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute("""
                SELECT concept_id FROM course_concepts
                WHERE user_id=? AND course_id=? AND doc_id=? AND concept_name=? AND tier=?
            """, (user_id, course_id, doc_id, concept_name, tier)).fetchone()

            if row:
                return row["concept_id"]

            concept_id = str(uuid.uuid4())
            xp_cap = XP_CAP_TOTAL if tier == 3 else 0  # only subtopics have XP caps
            conn.execute("""
                INSERT INTO course_concepts
                  (course_id, user_id, doc_id, concept_id, concept_name,
                   parent_concept_id, tier, weight, xp_cap)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (course_id, user_id, doc_id, concept_id, concept_name,
                  parent_concept_id, tier, weight, xp_cap))
            conn.commit()
            return concept_id

    def get_concept_graph(self, user_id: str, course_id: str) -> List[Dict]:
        """Return all concept nodes for a course (all documents)."""
        with sqlite3.connect(self.db_path, timeout=10) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute("""
                SELECT cc.*, cms.mastery_pct, cms.total_xp,
                       cms.flashcard_xp, cms.quiz_xp, cms.tutor_xp, cms.reading_xp
                FROM course_concepts cc
                LEFT JOIN concept_mastery_scores cms
                  ON cc.concept_id = cms.concept_id
                  AND cms.user_id = ?
                WHERE cc.user_id = ? AND cc.course_id = ?
                ORDER BY cc.doc_id, cc.tier, cc.concept_name
            """, (user_id, user_id, course_id)).fetchall()
            return [dict(r) for r in rows]

    def get_document_concept_graph(self, user_id: str, course_id: str,
                                    doc_id: str) -> List[Dict]:
        """Return concept nodes for a single document."""
        with sqlite3.connect(self.db_path, timeout=10) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute("""
                SELECT cc.*, cms.mastery_pct, cms.total_xp,
                       cms.flashcard_xp, cms.quiz_xp, cms.tutor_xp, cms.reading_xp
                FROM course_concepts cc
                LEFT JOIN concept_mastery_scores cms
                  ON cc.concept_id = cms.concept_id
                  AND cms.user_id = ?
                WHERE cc.user_id = ? AND cc.course_id = ? AND cc.doc_id = ?
                ORDER BY cc.tier, cc.concept_name
            """, (user_id, user_id, course_id, doc_id)).fetchall()
            return [dict(r) for r in rows]

    def get_subtopics_for_course(self, user_id: str, course_id: str,
                                  doc_id: str = None) -> List[Dict]:
        """Return all tier-3 subtopics, optionally filtered to one document."""
        with sqlite3.connect(self.db_path, timeout=10) as conn:
            conn.row_factory = sqlite3.Row
            if doc_id:
                rows = conn.execute("""
                    SELECT cc.*, COALESCE(cms.mastery_pct, 0) as mastery_pct,
                           COALESCE(cms.total_xp, 0) as total_xp,
                           COALESCE(cms.flashcard_xp, 0) as flashcard_xp,
                           COALESCE(cms.quiz_xp, 0) as quiz_xp,
                           COALESCE(cms.tutor_xp, 0) as tutor_xp,
                           cms.last_interaction
                    FROM course_concepts cc
                    LEFT JOIN concept_mastery_scores cms
                      ON cc.concept_id = cms.concept_id AND cms.user_id = ?
                    WHERE cc.user_id=? AND cc.course_id=? AND cc.doc_id=? AND cc.tier=3
                """, (user_id, user_id, course_id, doc_id)).fetchall()
            else:
                rows = conn.execute("""
                    SELECT cc.*, COALESCE(cms.mastery_pct, 0) as mastery_pct,
                           COALESCE(cms.total_xp, 0) as total_xp,
                           COALESCE(cms.flashcard_xp, 0) as flashcard_xp,
                           COALESCE(cms.quiz_xp, 0) as quiz_xp,
                           COALESCE(cms.tutor_xp, 0) as tutor_xp,
                           cms.last_interaction
                    FROM course_concepts cc
                    LEFT JOIN concept_mastery_scores cms
                      ON cc.concept_id = cms.concept_id AND cms.user_id = ?
                    WHERE cc.user_id=? AND cc.course_id=? AND cc.tier=3
                """, (user_id, user_id, course_id)).fetchall()
            return [dict(r) for r in rows]

    def get_weakest_subtopics(self, user_id: str, course_id: str,
                               limit: int = 20, doc_id: str = None) -> List[Dict]:
        """
        Return subtopics sorted for adaptive learning priority:
          1. Never studied (mastery_pct = 0 or NULL) — highest priority
          2. Lowest mastery % among studied ones
          3. Longest time since last interaction (decay consideration)
          4. Core weight before supporting before peripheral
        """
        with sqlite3.connect(self.db_path, timeout=10) as conn:
            conn.row_factory = sqlite3.Row
            doc_filter = "AND cc.doc_id = ?" if doc_id else ""
            params = [user_id, user_id, course_id]
            if doc_id:
                params.append(doc_id)
            params.append(limit)

            rows = conn.execute(f"""
                SELECT cc.*,
                       COALESCE(cms.mastery_pct, 0) as mastery_pct,
                       COALESCE(cms.total_xp, 0) as total_xp,
                       cms.last_interaction,
                       CASE cc.weight WHEN 'core' THEN 3
                                      WHEN 'supporting' THEN 2
                                      ELSE 1 END as weight_val
                FROM course_concepts cc
                LEFT JOIN concept_mastery_scores cms
                  ON cc.concept_id = cms.concept_id AND cms.user_id = ?
                WHERE cc.user_id=? AND cc.course_id=? AND cc.tier=3
                {doc_filter}
                ORDER BY
                  COALESCE(cms.mastery_pct, -1) ASC,
                  cms.last_interaction ASC NULLS FIRST,
                  weight_val DESC
                LIMIT ?
            """, params).fetchall()
            return [dict(r) for r in rows]

    # -----------------------------------------------------------------------
    # XP recording
    # -----------------------------------------------------------------------

    def record_xp(self, user_id: str, course_id: str, doc_id: str,
                   concept_id: str, tool: str, xp_earned: int,
                   xp_source: str = None) -> bool:
        """
        Record XP earned for a subtopic. Enforces per-tool XP caps.
        Returns True if XP was recorded, False if cap already reached.
        """
        if xp_earned <= 0:
            return False

        tool_cap = {
            "flashcard": XP_CAP_FLASHCARD,
            "quiz": XP_CAP_QUIZ,
            "tutor": XP_CAP_TUTOR,
            "reading": XP_CAP_READING,
        }.get(tool, XP_CAP_TOTAL)

        with sqlite3.connect(self.db_path, timeout=10) as conn:
            # Check current tool XP for this subtopic
            row = conn.execute("""
                SELECT COALESCE(SUM(xp_earned), 0) as tool_xp
                FROM concept_xp
                WHERE user_id=? AND course_id=? AND concept_id=? AND tool=?
            """, (user_id, course_id, concept_id, tool)).fetchone()

            current_tool_xp = row[0] if row else 0
            available = tool_cap - current_tool_xp

            if available <= 0:
                logger.debug(f"XP cap reached for concept {concept_id} tool {tool}")
                return False

            # Clamp to available
            xp_to_record = min(xp_earned, available)

            conn.execute("""
                INSERT INTO concept_xp
                  (user_id, course_id, doc_id, concept_id, tool, xp_earned, xp_source)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (user_id, course_id, doc_id, concept_id, tool, xp_to_record, xp_source))
            conn.commit()
            return True

    # -----------------------------------------------------------------------
    # Mastery score computation
    # -----------------------------------------------------------------------

    def compute_and_store_subtopic_mastery(self, user_id: str, course_id: str,
                                            doc_id: str, concept_id: str) -> float:
        """
        Recompute mastery % for a single subtopic from its XP records.
        Applies forgetting curve decay based on time since last interaction.
        Stores result in concept_mastery_scores and returns the new %.
        """
        with sqlite3.connect(self.db_path, timeout=10) as conn:
            conn.row_factory = sqlite3.Row

            # Aggregate XP by tool
            rows = conn.execute("""
                SELECT tool, SUM(xp_earned) as total
                FROM concept_xp
                WHERE user_id=? AND course_id=? AND concept_id=?
                GROUP BY tool
            """, (user_id, course_id, concept_id)).fetchall()

            xp_by_tool = {r["tool"]: r["total"] for r in rows}
            flashcard_xp = xp_by_tool.get("flashcard", 0)
            quiz_xp = xp_by_tool.get("quiz", 0)
            tutor_xp = xp_by_tool.get("tutor", 0)
            reading_xp = xp_by_tool.get("reading", 0)
            total_xp = flashcard_xp + quiz_xp + tutor_xp + reading_xp

            # Compute raw mastery % (capped at 100)
            raw_pct = min(total_xp / XP_CAP_TOTAL * 100.0, 100.0) if total_xp > 0 else 0.0

            # Apply forgetting curve decay
            last_row = conn.execute("""
                SELECT last_interaction FROM concept_mastery_scores
                WHERE user_id=? AND course_id=? AND concept_id=?
            """, (user_id, course_id, concept_id)).fetchone()

            if last_row and last_row["last_interaction"]:
                try:
                    last_dt = datetime.fromisoformat(last_row["last_interaction"])
                    days_elapsed = (datetime.now() - last_dt).days
                    raw_pct = self._apply_forgetting_curve(raw_pct, days_elapsed)
                except Exception:
                    pass

            # Upsert into mastery scores
            conn.execute("""
                INSERT INTO concept_mastery_scores
                  (user_id, course_id, doc_id, concept_id, mastery_pct, total_xp,
                   flashcard_xp, quiz_xp, tutor_xp, reading_xp, last_interaction, last_updated)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id, course_id, doc_id, concept_id) DO UPDATE SET
                    mastery_pct = excluded.mastery_pct,
                    total_xp = excluded.total_xp,
                    flashcard_xp = excluded.flashcard_xp,
                    quiz_xp = excluded.quiz_xp,
                    tutor_xp = excluded.tutor_xp,
                    reading_xp = excluded.reading_xp,
                    last_interaction = CURRENT_TIMESTAMP,
                    last_updated = CURRENT_TIMESTAMP
            """, (user_id, course_id, doc_id, concept_id, round(raw_pct, 2),
                  total_xp, flashcard_xp, quiz_xp, tutor_xp, reading_xp))
            conn.commit()

        return round(raw_pct, 2)

    def compute_concept_mastery(self, user_id: str, course_id: str,
                                 doc_id: str, parent_concept_id: str) -> float:
        """
        Compute mastery % for a tier-2 concept as the weighted average
        of its tier-3 subtopics.
        """
        with sqlite3.connect(self.db_path, timeout=10) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute("""
                SELECT cc.weight, COALESCE(cms.mastery_pct, 0) as mastery_pct
                FROM course_concepts cc
                LEFT JOIN concept_mastery_scores cms
                  ON cc.concept_id = cms.concept_id AND cms.user_id = ?
                WHERE cc.user_id=? AND cc.course_id=? AND cc.doc_id=?
                  AND cc.parent_concept_id=? AND cc.tier=3
            """, (user_id, user_id, course_id, doc_id, parent_concept_id)).fetchall()

            if not rows:
                return 0.0

            weighted_sum = sum(r["mastery_pct"] * WEIGHT_VALUES.get(r["weight"], 1) for r in rows)
            total_weight = sum(WEIGHT_VALUES.get(r["weight"], 1) for r in rows)
            return round(weighted_sum / total_weight, 2) if total_weight else 0.0

    def compute_document_mastery(self, user_id: str, course_id: str,
                                  doc_id: str) -> float:
        """
        Compute mastery % for a document as the weighted average
        of its tier-2 concepts (each concept's score is the avg of its subtopics).
        """
        with sqlite3.connect(self.db_path, timeout=10) as conn:
            conn.row_factory = sqlite3.Row
            concepts = conn.execute("""
                SELECT concept_id, weight FROM course_concepts
                WHERE user_id=? AND course_id=? AND doc_id=? AND tier=2
            """, (user_id, course_id, doc_id)).fetchall()

            if not concepts:
                return 0.0

            weighted_sum = 0.0
            total_weight = 0.0
            for c in concepts:
                concept_pct = self.compute_concept_mastery(
                    user_id, course_id, doc_id, c["concept_id"]
                )
                w = WEIGHT_VALUES.get(c["weight"], 1)
                weighted_sum += concept_pct * w
                total_weight += w

            return round(weighted_sum / total_weight, 2) if total_weight else 0.0

    def compute_course_mastery(self, user_id: str, course_id: str) -> Dict[str, Any]:
        """
        Compute overall course mastery % as the document-weight-averaged
        mastery of all documents in the course.

        Returns:
            {
              "course_mastery_pct": float,
              "documents": [
                { "doc_id", "filename", "mastery_pct", "document_weight", "extraction_status" }
              ]
            }
        """
        docs = self.list_documents(user_id, course_id)
        if not docs:
            return {"course_mastery_pct": 0.0, "documents": []}

        doc_results = []
        total_weight = 0.0
        weighted_sum = 0.0

        for doc in docs:
            if doc["extraction_status"] != "complete":
                doc_results.append({
                    "doc_id": doc["doc_id"],
                    "filename": doc["filename"],
                    "mastery_pct": 0.0,
                    "document_weight": doc["document_weight"],
                    "extraction_status": doc["extraction_status"],
                })
                continue

            doc_mastery = self.compute_document_mastery(user_id, course_id, doc["doc_id"])
            w = doc["document_weight"]
            weighted_sum += doc_mastery * w
            total_weight += w

            doc_results.append({
                "doc_id": doc["doc_id"],
                "filename": doc["filename"],
                "mastery_pct": doc_mastery,
                "document_weight": w,
                "extraction_status": doc["extraction_status"],
            })

        course_pct = round(weighted_sum / total_weight, 2) if total_weight > 0 else 0.0
        return {"course_mastery_pct": course_pct, "documents": doc_results}

    # -----------------------------------------------------------------------
    # Event logging
    # -----------------------------------------------------------------------

    def log_mastery_event(self, user_id: str, course_id: str, doc_id: str,
                           concept_id: str, event_type: str, xp_delta: int,
                           mastery_delta: float, tool: str,
                           difficulty: str = None, metadata: dict = None) -> int:
        """Log a mastery event and snapshot current course mastery."""
        course_data = self.compute_course_mastery(user_id, course_id)
        course_mastery_after = course_data["course_mastery_pct"]

        with sqlite3.connect(self.db_path, timeout=10) as conn:
            cursor = conn.execute("""
                INSERT INTO mastery_events
                  (user_id, course_id, doc_id, concept_id, event_type, xp_delta,
                   mastery_delta, course_mastery_after, tool, difficulty, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (user_id, course_id, doc_id, concept_id, event_type, xp_delta,
                  mastery_delta, course_mastery_after, tool, difficulty,
                  json.dumps(metadata) if metadata else None))
            conn.commit()
            return cursor.lastrowid

    # -----------------------------------------------------------------------
    # Pending tutor XP
    # -----------------------------------------------------------------------

    def create_pending_tutor_xp(self, user_id: str, course_id: str, doc_id: str,
                                  concept_id: str, session_id: str, pending_xp: int,
                                  trajectory: str, assessment_question: str,
                                  assessment_answer: str) -> bool:
        """Create a pending tutor XP record with 24-hour expiry."""
        expires_at = datetime.now() + timedelta(hours=24)
        try:
            with sqlite3.connect(self.db_path, timeout=10) as conn:
                conn.execute("""
                    INSERT OR REPLACE INTO pending_tutor_xp
                      (user_id, course_id, doc_id, concept_id, session_id, pending_xp,
                       trajectory, assessment_question, assessment_answer,
                       status, expires_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
                """, (user_id, course_id, doc_id, concept_id, session_id,
                      pending_xp, trajectory, assessment_question,
                      assessment_answer, expires_at.isoformat()))
                conn.commit()
                return True
        except Exception as e:
            logger.error(f"Error creating pending tutor XP: {e}")
            return False

    def get_pending_tutor_xp(self, user_id: str, session_id: str) -> Optional[Dict]:
        """Get a pending tutor XP record if it exists and hasn't expired."""
        with sqlite3.connect(self.db_path, timeout=10) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute("""
                SELECT * FROM pending_tutor_xp
                WHERE user_id=? AND session_id=? AND status='pending'
                  AND expires_at > CURRENT_TIMESTAMP
            """, (user_id, session_id)).fetchone()
            return dict(row) if row else None

    def resolve_pending_tutor_xp(self, user_id: str, session_id: str,
                                   outcome: str) -> Optional[Dict]:
        """
        Resolve a pending tutor XP record.
        outcome: 'correct' | 'incorrect' | 'skipped'
        Returns the resolved record with final XP awarded.
        """
        pending = self.get_pending_tutor_xp(user_id, session_id)
        if not pending:
            return None

        pending_xp = pending["pending_xp"]
        if outcome == "correct":
            final_xp = pending_xp           # full credit
            status = "confirmed"
        elif outcome == "skipped":
            final_xp = int(pending_xp * 0.4)  # 40% engagement credit
            status = "confirmed"
        else:  # incorrect
            final_xp = 0
            status = "denied"

        with sqlite3.connect(self.db_path, timeout=10) as conn:
            conn.execute("""
                UPDATE pending_tutor_xp SET status=? WHERE user_id=? AND session_id=?
            """, (status, user_id, session_id))
            conn.commit()

        pending["final_xp"] = final_xp
        pending["outcome"] = outcome
        return pending

    def expire_pending_tutor_xp(self) -> int:
        """Mark all expired pending records as 'expired'. Returns count updated."""
        with sqlite3.connect(self.db_path, timeout=10) as conn:
            cursor = conn.execute("""
                UPDATE pending_tutor_xp
                SET status='expired'
                WHERE status='pending' AND expires_at <= CURRENT_TIMESTAMP
            """)
            conn.commit()
            return cursor.rowcount

    def get_user_pending_assessments(self, user_id: str) -> List[Dict]:
        """Get all active pending micro-assessments for a user."""
        with sqlite3.connect(self.db_path, timeout=10) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute("""
                SELECT p.*, cc.concept_name, cd.filename
                FROM pending_tutor_xp p
                JOIN course_concepts cc ON p.concept_id = cc.concept_id
                JOIN course_documents cd ON p.doc_id = cd.doc_id
                WHERE p.user_id=? AND p.status='pending'
                  AND p.expires_at > CURRENT_TIMESTAMP
                ORDER BY p.created_at DESC
            """, (user_id,)).fetchall()
            return [dict(r) for r in rows]

    # -----------------------------------------------------------------------
    # Study session (heartbeat)
    # -----------------------------------------------------------------------

    def log_heartbeat(self, user_id: str, course_id: str, tool: str,
                       duration_seconds: int, doc_id: str = None):
        """Log a 30-second productive study heartbeat."""
        with sqlite3.connect(self.db_path, timeout=10) as conn:
            conn.execute("""
                INSERT INTO study_sessions
                  (user_id, course_id, doc_id, tool, productive_seconds, session_date)
                VALUES (?, ?, ?, ?, ?, DATE('now'))
            """, (user_id, course_id, doc_id, tool, duration_seconds))
            conn.commit()

    def get_daily_study_time(self, user_id: str, course_id: str,
                              date: str = None) -> Dict[str, Any]:
        """
        Get productive study time for a course on a given date (default: today).
        Returns total seconds and breakdown by tool.
        """
        if not date:
            date = datetime.now().strftime("%Y-%m-%d")
        with sqlite3.connect(self.db_path, timeout=10) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute("""
                SELECT tool, SUM(productive_seconds) as total_seconds
                FROM study_sessions
                WHERE user_id=? AND course_id=? AND session_date=?
                GROUP BY tool
            """, (user_id, course_id, date)).fetchall()

            by_tool = {r["tool"]: r["total_seconds"] for r in rows}
            total = sum(by_tool.values())
            return {"date": date, "total_seconds": total, "by_tool": by_tool}

    # -----------------------------------------------------------------------
    # Daily mastery breakdown
    # -----------------------------------------------------------------------

    def get_daily_mastery_summary(self, user_id: str, course_id: str,
                                   date: str = None) -> Dict[str, Any]:
        """
        Today's XP earned, which concepts moved, and from which tools.
        """
        if not date:
            date = datetime.now().strftime("%Y-%m-%d")

        with sqlite3.connect(self.db_path, timeout=10) as conn:
            conn.row_factory = sqlite3.Row

            # Total XP earned today
            xp_row = conn.execute("""
                SELECT COALESCE(SUM(xp_delta), 0) as total_xp,
                       COALESCE(SUM(CASE WHEN mastery_delta > 0 THEN mastery_delta ELSE 0 END), 0) as mastery_gained
                FROM mastery_events
                WHERE user_id=? AND course_id=? AND DATE(created_at)=?
            """, (user_id, course_id, date)).fetchone()

            # Per-concept events today
            concept_rows = conn.execute("""
                SELECT me.concept_id, cc.concept_name, cc.doc_id, cd.filename,
                       SUM(me.xp_delta) as xp_today,
                       SUM(me.mastery_delta) as mastery_delta_today,
                       GROUP_CONCAT(DISTINCT me.tool) as tools_used
                FROM mastery_events me
                JOIN course_concepts cc ON me.concept_id = cc.concept_id
                JOIN course_documents cd ON me.doc_id = cd.doc_id
                WHERE me.user_id=? AND me.course_id=? AND DATE(me.created_at)=?
                GROUP BY me.concept_id
                ORDER BY xp_today DESC
                LIMIT 20
            """, (user_id, course_id, date)).fetchall()

            return {
                "date": date,
                "total_xp_today": xp_row["total_xp"] if xp_row else 0,
                "mastery_gained_today": round(xp_row["mastery_gained"], 2) if xp_row else 0,
                "concepts_touched": [dict(r) for r in concept_rows],
            }

    def get_xp_summary(self, user_id: str, course_id: str, days: int = 30) -> List[Dict]:
        """XP earned per day per tool for the last N days (for charts)."""
        with sqlite3.connect(self.db_path, timeout=10) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute("""
                SELECT DATE(created_at) as date, tool,
                       SUM(xp_delta) as xp_earned
                FROM mastery_events
                WHERE user_id=? AND course_id=?
                  AND created_at >= datetime('now', ? || ' days')
                GROUP BY DATE(created_at), tool
                ORDER BY date ASC
            """, (user_id, course_id, f"-{days}")).fetchall()
            return [dict(r) for r in rows]

    # -----------------------------------------------------------------------
    # Forgetting curve
    # -----------------------------------------------------------------------

    def _apply_forgetting_curve(self, mastery_pct: float, days_elapsed: int) -> float:
        """
        Apply Ebbinghaus exponential decay to a mastery percentage.
        Formula: R(t) = R(0) * e^(-t/S)
        Strength S scales with mastery level — higher mastery decays slower.
        """
        if days_elapsed <= 0 or mastery_pct <= 0:
            return mastery_pct

        retention_ratio = mastery_pct / 100.0
        strength = FORGETTING_STRENGTH_BASE * (1 + retention_ratio)  # 7–14 days
        decay_factor = math.exp(-days_elapsed / strength)
        decayed = mastery_pct * decay_factor

        # Floor: don't let it drop more than 40 points at once
        min_score = max(0.0, mastery_pct - 40.0)
        return round(max(min_score, decayed), 2)

    def apply_decay_to_course(self, user_id: str, course_id: str) -> int:
        """
        Apply forgetting curve to all subtopic mastery scores in a course.
        Skips subtopics updated today. Returns number of subtopics updated.
        """
        with sqlite3.connect(self.db_path, timeout=10) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute("""
                SELECT concept_id, doc_id, mastery_pct, last_interaction
                FROM concept_mastery_scores
                WHERE user_id=? AND course_id=?
                  AND DATE(last_interaction) < DATE('now')
                  AND mastery_pct > 0
            """, (user_id, course_id)).fetchall()

            updated = 0
            for row in rows:
                try:
                    last_dt = datetime.fromisoformat(row["last_interaction"])
                    days = (datetime.now() - last_dt).days
                    if days < 1:
                        continue
                    decayed = self._apply_forgetting_curve(row["mastery_pct"], days)
                    if abs(decayed - row["mastery_pct"]) > 0.5:
                        conn.execute("""
                            UPDATE concept_mastery_scores
                            SET mastery_pct=?, last_updated=CURRENT_TIMESTAMP
                            WHERE user_id=? AND course_id=? AND concept_id=?
                        """, (decayed, user_id, course_id, row["concept_id"]))
                        updated += 1
                except Exception:
                    continue
            conn.commit()
            return updated

    def get_stale_subtopics(self, user_id: str, course_id: str,
                             days_threshold: int = 14) -> List[Dict]:
        """
        Return subtopics not interacted with for >= days_threshold days.
        Includes predicted current score after decay.
        """
        with sqlite3.connect(self.db_path, timeout=10) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute("""
                SELECT cms.concept_id, cms.doc_id, cms.mastery_pct,
                       cc.concept_name, cc.weight, cd.filename,
                       CAST((julianday('now') - julianday(cms.last_interaction)) AS INTEGER)
                         as days_since
                FROM concept_mastery_scores cms
                JOIN course_concepts cc ON cms.concept_id = cc.concept_id
                JOIN course_documents cd ON cms.doc_id = cd.doc_id
                WHERE cms.user_id=? AND cms.course_id=?
                  AND julianday('now') - julianday(cms.last_interaction) >= ?
                  AND cms.mastery_pct > 0
                ORDER BY cms.mastery_pct ASC, cms.last_interaction ASC
                LIMIT 30
            """, (user_id, course_id, days_threshold)).fetchall()

            result = []
            for r in rows:
                predicted = self._apply_forgetting_curve(r["mastery_pct"], r["days_since"])
                result.append({
                    **dict(r),
                    "predicted_pct": predicted,
                    "decay_amount": round(r["mastery_pct"] - predicted, 2),
                })
            return result

    # -----------------------------------------------------------------------
    # Reset
    # -----------------------------------------------------------------------

    def reset_course_mastery(self, user_id: str, course_id: str) -> bool:
        """Hard reset — clears all XP, mastery scores, and events for a course."""
        try:
            with sqlite3.connect(self.db_path, timeout=10) as conn:
                for table in ["concept_xp", "concept_mastery_scores",
                               "mastery_events", "pending_tutor_xp", "study_sessions"]:
                    conn.execute(
                        f"DELETE FROM {table} WHERE user_id=? AND course_id=?",
                        (user_id, course_id)
                    )
                conn.commit()
            logger.info(f"Mastery V2 reset for user={user_id} course={course_id}")
            return True
        except Exception as e:
            logger.error(f"Reset error: {e}")
            return False


# ---------------------------------------------------------------------------
# Global singleton
# ---------------------------------------------------------------------------
mastery_v2_db = MasteryV2Database()
