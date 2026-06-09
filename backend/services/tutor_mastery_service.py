"""
Tutor Mastery Service — Phase 3, Tasks 3.1 + 3.2 + 3.3

Handles all mastery-related logic for AI Tutor sessions:

  1. Subtopic detector   — classifies which course subtopic the current
                           conversation thread is about
  2. Trajectory classifier — determines if the conversation is converging
                             (student is understanding) or diverging
  3. Pending XP flow     — when a concept thread ends with a good trajectory,
                           generates a micro-assessment question and writes
                           pending XP to mastery_v2_db

Designed to be called at the END of each tutor response so it runs
asynchronously and never blocks the streaming response.

Usage (from rag_service / chat route):
    from services.tutor_mastery_service import tutor_mastery_service

    result = await tutor_mastery_service.process_tutor_exchange(
        user_id="1",
        course_id="bio101",
        session_id="abc-123",           # UUID per browser session
        conversation_history=[          # last N Q&A pairs
            {"question": "...", "answer": "..."},
        ],
        api_key=None,
    )
    # result = {
    #   "subtopic_id": str | None,
    #   "doc_id": str | None,
    #   "trajectory": "converging" | "diverging" | "off_concept",
    #   "pending_xp": int,
    #   "micro_assessment": {"question": str, "answer": str} | None,
    #   "assessment_ready": bool,
    # }
"""

import uuid
import logging
import json
import re
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# XP amounts awarded as pending (confirmed/denied by micro-assessment)
# ---------------------------------------------------------------------------
PENDING_XP_CONVERGING = 12   # full credit if micro-assessment correct
PENDING_XP_DIVERGING = 6     # partial credit — student tried but struggled

# Minimum exchanges before we classify trajectory (avoid single-Q sessions)
MIN_EXCHANGES_FOR_ASSESSMENT = 2


class TutorMasteryService:

    # -----------------------------------------------------------------------
    # Main entry point
    # -----------------------------------------------------------------------

    async def process_tutor_exchange(
        self,
        user_id: str,
        course_id: str,
        session_id: str,
        conversation_history: List[Dict[str, str]],
        api_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Called after every tutor response. Analyses the conversation so far,
        detects the subtopic, classifies trajectory, and writes pending XP
        when appropriate.

        Args:
            user_id:              User ID
            course_id:            Course ID
            session_id:           Unique ID for this browser chat session
            conversation_history: List of {"question": str, "answer": str}
                                  (last N exchanges, newest last)
            api_key:              Groq API key (optional)

        Returns:
            Dict with subtopic_id, doc_id, trajectory, pending_xp,
            micro_assessment, assessment_ready
        """
        default = {
            "subtopic_id": None,
            "doc_id": None,
            "trajectory": "off_concept",
            "pending_xp": 0,
            "micro_assessment": None,
            "assessment_ready": False,
        }

        if not conversation_history:
            return default

        try:
            from models.global_models import get_llm
            llm = get_llm(api_key=api_key)

            # 1. Detect subtopic
            subtopic_result = await self._detect_subtopic(
                user_id, course_id, conversation_history, llm
            )
            subtopic_id = subtopic_result.get("concept_id")
            doc_id = subtopic_result.get("doc_id")
            subtopic_name = subtopic_result.get("concept_name", "this concept")

            # 2. Classify trajectory
            trajectory = await self._classify_trajectory(
                conversation_history, subtopic_name, llm
            )

            logger.info(
                f"[TutorMastery] user={user_id} session={session_id[:8]} "
                f"subtopic='{subtopic_name}' trajectory={trajectory}"
            )

            # 3. Only create pending XP if we have enough conversation
            #    AND the trajectory is not off_concept
            if (
                len(conversation_history) < MIN_EXCHANGES_FOR_ASSESSMENT
                or trajectory == "off_concept"
                or not subtopic_id
            ):
                return {**default, "trajectory": trajectory,
                        "subtopic_id": subtopic_id, "doc_id": doc_id}

            # 4. Check if pending XP already exists for this session
            from database.mastery_v2_db import mastery_v2_db
            existing = mastery_v2_db.get_pending_tutor_xp(user_id, session_id)
            if existing:
                # Already created — just return current state
                return {
                    "subtopic_id": subtopic_id,
                    "doc_id": doc_id,
                    "trajectory": trajectory,
                    "pending_xp": existing["pending_xp"],
                    "micro_assessment": {
                        "question": existing["assessment_question"],
                        "answer": existing["assessment_answer"],
                    },
                    "assessment_ready": True,
                }

            # 5. Generate micro-assessment question
            pending_xp = (
                PENDING_XP_CONVERGING if trajectory == "converging"
                else PENDING_XP_DIVERGING
            )
            micro = await self._generate_micro_assessment(
                subtopic_name, conversation_history, llm
            )
            if not micro:
                return {**default, "trajectory": trajectory,
                        "subtopic_id": subtopic_id, "doc_id": doc_id}

            # 6. Write pending XP to database
            mastery_v2_db.create_pending_tutor_xp(
                user_id=user_id,
                course_id=course_id,
                doc_id=doc_id,
                concept_id=subtopic_id,
                session_id=session_id,
                pending_xp=pending_xp,
                trajectory=trajectory,
                assessment_question=micro["question"],
                assessment_answer=micro["answer"],
            )

            logger.info(
                f"[TutorMastery] Pending XP created: {pending_xp} XP | "
                f"subtopic='{subtopic_name}' | session={session_id[:8]}"
            )

            return {
                "subtopic_id": subtopic_id,
                "doc_id": doc_id,
                "trajectory": trajectory,
                "pending_xp": pending_xp,
                "micro_assessment": micro,
                "assessment_ready": True,
            }

        except Exception as e:
            logger.error(f"[TutorMastery] process_tutor_exchange error: {e}")
            return default

    # -----------------------------------------------------------------------
    # Task 3.2 — Subtopic detector
    # -----------------------------------------------------------------------

    async def _detect_subtopic(
        self,
        user_id: str,
        course_id: str,
        conversation_history: List[Dict[str, str]],
        llm,
    ) -> Dict[str, Any]:
        """
        Identify which subtopic from the course concept graph the conversation
        is primarily about. Returns the closest matching subtopic record.
        """
        empty = {"concept_id": None, "doc_id": None, "concept_name": None}

        try:
            from database.mastery_v2_db import mastery_v2_db
            subtopics = mastery_v2_db.get_subtopics_for_course(user_id, course_id)
            if not subtopics:
                return empty

            # Build a compact list of subtopic names for the LLM
            subtopic_names = [s["concept_name"] for s in subtopics]
            names_block = "\n".join(f"- {n}" for n in subtopic_names[:60])

            # Use the last 3 questions as the conversation summary
            recent_questions = " | ".join(
                ex["question"] for ex in conversation_history[-3:]
            )

            prompt = (
                f"You are a course concept classifier.\n\n"
                f"COURSE SUBTOPICS:\n{names_block}\n\n"
                f"STUDENT QUESTIONS: {recent_questions}\n\n"
                f"Which ONE subtopic from the list above best matches what "
                f"the student is studying? Reply with ONLY the exact subtopic "
                f"name from the list, nothing else. If none match, reply NONE."
            )

            response = await llm.ainvoke(prompt)
            matched_name = (
                response.content if hasattr(response, "content") else str(response)
            ).strip()

            if matched_name.upper() == "NONE" or not matched_name:
                return empty

            # Find the subtopic record (exact match first, then partial)
            for s in subtopics:
                if s["concept_name"].lower() == matched_name.lower():
                    return {
                        "concept_id": s["concept_id"],
                        "doc_id": s["doc_id"],
                        "concept_name": s["concept_name"],
                    }

            # Partial match fallback
            for s in subtopics:
                if (matched_name.lower() in s["concept_name"].lower() or
                        s["concept_name"].lower() in matched_name.lower()):
                    return {
                        "concept_id": s["concept_id"],
                        "doc_id": s["doc_id"],
                        "concept_name": s["concept_name"],
                    }

            return empty

        except Exception as e:
            logger.warning(f"[TutorMastery] _detect_subtopic error: {e}")
            return empty

    # -----------------------------------------------------------------------
    # Task 3.1 — Trajectory classifier
    # -----------------------------------------------------------------------

    async def _classify_trajectory(
        self,
        conversation_history: List[Dict[str, str]],
        subtopic_name: str,
        llm,
    ) -> str:
        """
        Classify the conversation trajectory as:
          - converging:  Each follow-up narrows in, student is integrating the concept
          - diverging:   Student keeps re-asking variants, explanation not landing
          - off_concept: Conversation has drifted away from the subtopic

        Returns one of: 'converging' | 'diverging' | 'off_concept'
        """
        try:
            # Build a compact conversation summary (last 4 exchanges max)
            recent = conversation_history[-4:]
            convo_summary = "\n".join(
                f"Q: {ex['question']}\nA: {ex['answer'][:200]}..."
                for ex in recent
            )

            prompt = (
                f"You are analysing a student's conversation with an AI tutor "
                f"about the topic: '{subtopic_name}'.\n\n"
                f"CONVERSATION:\n{convo_summary}\n\n"
                f"Classify the student's understanding trajectory:\n"
                f"- converging: Follow-up questions build on previous answers, "
                f"showing the student is integrating the concept deeper.\n"
                f"- diverging: Student keeps asking variations of the same basic "
                f"question, suggesting the explanation is not landing.\n"
                f"- off_concept: The conversation has drifted away from "
                f"'{subtopic_name}' entirely.\n\n"
                f"NOTE: Asking multiple questions does NOT automatically mean "
                f"diverging — it depends on whether the questions are building "
                f"deeper understanding or repeating the same confusion.\n\n"
                f"Reply with ONLY one word: converging, diverging, or off_concept."
            )

            response = await llm.ainvoke(prompt)
            raw = (
                response.content if hasattr(response, "content") else str(response)
            ).strip().lower()

            # Extract classification from response
            if "converging" in raw:
                return "converging"
            elif "diverging" in raw:
                return "diverging"
            else:
                return "off_concept"

        except Exception as e:
            logger.warning(f"[TutorMastery] _classify_trajectory error: {e}")
            return "off_concept"

    # -----------------------------------------------------------------------
    # Micro-assessment question generator
    # -----------------------------------------------------------------------

    async def _generate_micro_assessment(
        self,
        subtopic_name: str,
        conversation_history: List[Dict[str, str]],
        llm,
    ) -> Optional[Dict[str, str]]:
        """
        Generate a single targeted micro-assessment question for the subtopic.
        Returns {"question": str, "answer": str} or None on failure.
        """
        try:
            # Use the last answer as context for question generation
            last_answer = conversation_history[-1].get("answer", "")[:500]

            prompt = (
                f"You are creating a single quick comprehension check question "
                f"about '{subtopic_name}'.\n\n"
                f"RECENT TUTOR EXPLANATION:\n{last_answer}\n\n"
                f"Create ONE short question that tests whether the student "
                f"understood the key concept just explained. The question should "
                f"be answerable in 1-2 sentences.\n\n"
                f"Return ONLY valid JSON, no markdown:\n"
                f'{{"question": "...", "answer": "..."}}\n\n'
                f"The answer should be a concise model answer (1-2 sentences)."
            )

            response = await llm.ainvoke(prompt)
            raw = (
                response.content if hasattr(response, "content") else str(response)
            ).strip()

            # Parse JSON
            raw = re.sub(r"```(?:json)?", "", raw).strip().replace("```", "")
            match = re.search(r'\{.*\}', raw, re.DOTALL)
            if match:
                data = json.loads(match.group())
                if "question" in data and "answer" in data:
                    return {
                        "question": data["question"].strip(),
                        "answer": data["answer"].strip(),
                    }

            return None

        except Exception as e:
            logger.warning(f"[TutorMastery] _generate_micro_assessment error: {e}")
            return None


# ---------------------------------------------------------------------------
# Global singleton
# ---------------------------------------------------------------------------
tutor_mastery_service = TutorMasteryService()
