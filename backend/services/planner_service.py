from config import settings
from typing import Optional
from pathlib import Path
from models.global_models import get_llm
from datetime import datetime
from services.document_processor import DocumentProcessor
from services.concept_service import concept_service
from database.mastery_db import mastery_db
import json
from utils.file_utils import get_absolute_path
from database.auth_db import auth_db
import logging

logger = logging.getLogger(__name__)


class PlannerService:
    """
    Study planner service using local LLM.
    Mastery-aware: weights the schedule toward weak/decaying subtopics.
    """
    
    def __init__(self):
        self.doc_processor = DocumentProcessor()
    
    def _build_mastery_context(self, user_id: str, course_id: str) -> str:
        """
        Build a rich mastery context string for the LLM prompt.
        Uses V2 mastery data (subtopic-level with weights + decay) if available,
        falls back to legacy mastery_db.
        """
        # ── Try V2 first (richer data) ───────────────────────────────────────
        try:
            from database.mastery_v2_db import mastery_v2_db

            # Weakest subtopics — sorted by priority (never studied first, then lowest mastery)
            weak = mastery_v2_db.get_weakest_subtopics(user_id, course_id, limit=20)
            stale = mastery_v2_db.get_stale_subtopics(user_id, course_id, days_threshold=7)

            if not weak and not stale:
                raise ValueError("No V2 data")  # fall through to legacy

            urgent   = []  # never studied OR mastery < 20% OR actively decaying
            review   = []  # mastery 20–60%
            solid    = []  # mastery > 60%

            for s in weak:
                pct  = s.get("mastery_pct", 0) or 0
                name = s.get("concept_name", "")
                weight = s.get("weight", "supporting")
                label = f"{name} [{weight}]"
                if pct == 0 or s.get("total_xp", 0) == 0:
                    urgent.append(label)
                elif pct < 20:
                    urgent.append(label)
                elif pct < 60:
                    review.append(label)
                else:
                    solid.append(label)

            # Add stale subtopics to urgent if high decay
            for s in stale:
                decay = s.get("decay_amount", 0)
                name  = s.get("concept_name", "")
                if decay > 10 and name and name + " [stale]" not in urgent:
                    urgent.append(f"{name} [decaying, {s.get('days_since', 0)}d ago]")

            # Also include per-document mastery for high-level weighting
            course_data = mastery_v2_db.compute_course_mastery(user_id, course_id)
            doc_lines = []
            for doc in course_data.get("documents", []):
                if doc["extraction_status"] == "complete":
                    doc_lines.append(
                        f"  {doc['filename']}: {doc['mastery_pct']:.0f}% mastered"
                    )

            lines = ["STUDENT MASTERY PROFILE — V2 (use to weight the study plan):"]
            if urgent:
                lines.append(f"  URGENT — allocate most days here: {', '.join(urgent[:10])}")
            if review:
                lines.append(f"  NEEDS REVIEW — allocate moderate time: {', '.join(review[:8])}")
            if solid:
                lines.append(f"  SOLID — brief revision only: {', '.join(solid[:5])}")
            if doc_lines:
                lines.append("  PER-DOCUMENT PROGRESS:")
                lines.extend(doc_lines)
            lines.append(
                "  INSTRUCTION: Start the plan with URGENT subtopics. "
                "Core-weight subtopics get priority slots. "
                "Stale/decaying subtopics need review before new material."
            )
            return "\n".join(lines)

        except Exception:
            pass  # fall through to legacy

        # ── Legacy fallback ──────────────────────────────────────────────────
        try:
            profile = mastery_db.get_user_mastery(user_id, course_id)
            if not profile:
                return ""

            urgent, review, solid = [], [], []
            for item in profile:
                score   = item.get('familiarity_score', 0)
                concept = item.get('concept_id', '')
                if not concept: continue
                if score < -0.2:   urgent.append(concept)
                elif score <= 0.4: review.append(concept)
                else:              solid.append(concept)

            if not urgent and not review and not solid:
                return ""

            lines = ["STUDENT MASTERY PROFILE (use this to weight the study plan):"]
            if urgent:
                lines.append(f"  URGENT — allocate the MOST study days: {', '.join(urgent[:8])}")
            if review:
                lines.append(f"  NEEDS REVIEW — allocate moderate time: {', '.join(review[:8])}")
            if solid:
                lines.append(f"  SOLID — brief revision only: {', '.join(solid[:6])}")
            lines.append("  INSTRUCTION: Distribute daily tasks so URGENT concepts appear earliest and most frequently.")
            return "\n".join(lines)
        except Exception as e:
            logger.warning(f"Could not build mastery context: {e}")
            return ""

    def create_study_plan(self, user_id: str, course_id: str, course_name: str, exam_date: str, topics: list, focus_topic: Optional[str] = None, api_key: Optional[str] = None):
        """Generate personalized study plan using local LLM with mastery adaptation"""
        logger.info(f"Creating mastery-adaptive study plan for {course_name} ({course_id})")
        
        llm = get_llm(api_key)
        
        today_dt = datetime.now()
        today    = today_dt.strftime("%Y-%m-%d")
        today_day_name = today_dt.strftime("%A")
        
        try:
            exam_dt      = datetime.strptime(exam_date, "%Y-%m-%d")
            delta        = exam_dt - today_dt
            days_until   = delta.days
            weeks_until  = max(1, (days_until // 7) + 1)
            plan_weeks   = min(12, weeks_until)
            duration_text = f"{plan_weeks} weeks ({days_until} days)"
        except Exception:
            plan_weeks    = 2
            duration_text = "2 weeks"
        
        # Rich mastery context from real DB scores
        mastery_context = self._build_mastery_context(user_id, course_id)
        
        # Preferred language
        preferred_language = "en"
        if user_id.isdigit():
            try:
                preferred_language = auth_db.get_preferred_language(int(user_id))
            except Exception:
                pass

        # Build prompt prefix
        sections = []

        if focus_topic:
            sections.append(
                f"TOPIC FOCUS: Prioritise '{focus_topic}' throughout the plan. "
                f"Allocate more days and tasks to this topic than others."
            )

        if mastery_context:
            sections.append(mastery_context)

        sections.append(
            f"LANGUAGE: Generate ALL content in '{preferred_language}'. "
            f"Translate course material if needed."
        )

        prompt_prefix = "\n\n".join(sections) + "\n\n" if sections else ""

        prompt = f"""{prompt_prefix}Create a comprehensive study plan for a student.

Course: {course_name}
Duration: {duration_text}
Start Date (Today): {today} ({today_day_name})
Exam Date: {exam_date}
Topics: {', '.join(topics)}

CRITICAL: Return ONLY a JSON object. No markdown, no extra text.
The plan MUST start precisely from today ({today}, which is a {today_day_name}) and progress chronologically. The very first day in the first week MUST be {today_day_name}. Do NOT automatically start the plan on a Monday unless today is Monday.
Weight the schedule so URGENT mastery gaps appear earliest and most frequently.

Format:
{{
  "weeks": [
    {{
      "week_number": 1,
      "focus": "Topic",
      "days": [
        {{
          "date": "YYYY-MM-DD",
          "day": "DayName",
          "tasks": ["Task 1", "Task 2"],
          "duration": "2h"
        }}
      ]
    }}
  ],
  "revision_plan": ["Tip"],
  "exam_tips": ["Tip"]
}}

Generate the plan starting from {today}:"""
        
        logger.info("Generating mastery-adaptive study plan with LLM...")
        response = llm.invoke(prompt)
        response_text = response if isinstance(response, str) else getattr(response, 'content', str(response))
        
        try:
            response_text = response_text.strip()
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0]
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0]
            
            start_idx = response_text.find("{")
            end_idx   = response_text.rfind("}")
            if start_idx != -1 and end_idx != -1:
                response_text = response_text[start_idx:end_idx+1]
            
            result = json.loads(response_text.strip())
            logger.info("Mastery-adaptive study plan generated successfully")
            return result
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse study plan JSON: {e}")
            return self._fallback_study_plan(course_name, topics)
        except Exception as e:
            logger.error(f"Unexpected error parsing study plan: {e}")
            return self._fallback_study_plan(course_name, topics)
    
    def discover_topics(self, user_id: str, course_id: str):
        """Discover potential study topics by analysing course documents"""
        logger.info(f"Discovering topics for course {course_id}")
        
        user_dir = Path(get_absolute_path(settings.UPLOAD_DIR)) / user_id / course_id
        if not user_dir.exists():
            return []
            
        all_concepts = []
        docs = [f for f in user_dir.iterdir() if f.is_file() and not f.name.endswith(".json")]
        
        for doc_path in docs[:5]:
            try:
                text = self.doc_processor.extract_text(str(doc_path))
                if text:
                    concepts = concept_service.extract_concepts_from_text(text[:2000])
                    all_concepts.extend(concepts)
            except Exception:
                continue
                
        return list(set(all_concepts))[:8]

    def _fallback_study_plan(self, course_name: str, topics: list):
        """Generate a basic fallback study plan"""
        logger.warning("Using fallback study plan")
        from datetime import datetime, timedelta
        today_dt = datetime.now()
        day1 = today_dt
        day2 = today_dt + timedelta(days=2)
        day3 = today_dt + timedelta(days=4)
        
        return {
            "weeks": [
                {
                    "week_number": 1,
                    "focus": topics[0] if topics else "Course fundamentals",
                    "days": [
                        {"date": day1.strftime("%Y-%m-%d"), "day": day1.strftime("%A"), "tasks": ["Review lecture notes"], "duration": "2 hours"},
                        {"date": day2.strftime("%Y-%m-%d"), "day": day2.strftime("%A"), "tasks": ["Practice problems"],    "duration": "2 hours"},
                        {"date": day3.strftime("%Y-%m-%d"), "day": day3.strftime("%A"), "tasks": ["Review and quiz"],      "duration": "1.5 hours"}
                    ]
                }
            ],
            "revision_plan": ["Review notes daily", "Practice problems regularly", "Create summary sheets"],
            "exam_tips":     ["Get good sleep before exam", "Practice past papers", "Review key concepts"]
        }
