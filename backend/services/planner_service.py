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
    Supports smart plan generation and automated topic discovery.
    """
    
    def __init__(self):
        self.doc_processor = DocumentProcessor()
    
    def _build_mastery_context(self, user_id: str, course_id: str) -> str:
        """
        Build a rich mastery context string for the LLM prompt.
        Pulls real familiarity scores and categorises concepts into
        urgent / review / solid tiers so the LLM can weight the plan.
        """
        try:
            profile = mastery_db.get_user_mastery(user_id, course_id)
            if not profile:
                return ""

            urgent  = []  # familiarity_score < -0.2  → needs most time
            review  = []  # -0.2 <= score <= 0.4      → needs some time
            solid   = []  # score > 0.4               → brief review only

            for item in profile:
                score   = item.get('familiarity_score', 0)
                concept = item.get('concept_id', '')
                if not concept:
                    continue
                if score < -0.2:
                    urgent.append(concept)
                elif score <= 0.4:
                    review.append(concept)
                else:
                    solid.append(concept)

            if not urgent and not review and not solid:
                return ""

            lines = ["STUDENT MASTERY PROFILE (use this to weight the study plan):"]
            if urgent:
                lines.append(f"  URGENT — allocate the MOST study days to these (student is weakest here): {', '.join(urgent[:8])}")
            if review:
                lines.append(f"  NEEDS REVIEW — allocate moderate time: {', '.join(review[:8])}")
            if solid:
                lines.append(f"  SOLID — brief revision only, do not over-allocate: {', '.join(solid[:6])}")
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
Start Date (Today): {today}
Exam Date: {exam_date}
Topics: {', '.join(topics)}

CRITICAL: Return ONLY a JSON object. No markdown, no extra text.
The plan MUST start from today ({today}) and be organised by date.
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
        return {
            "weeks": [
                {
                    "week_number": 1,
                    "focus": topics[0] if topics else "Course fundamentals",
                    "days": [
                        {"day": "Monday",    "tasks": ["Review lecture notes"],  "duration": "2 hours"},
                        {"day": "Wednesday", "tasks": ["Practice problems"],     "duration": "2 hours"},
                        {"day": "Friday",    "tasks": ["Review and quiz"],       "duration": "1.5 hours"}
                    ]
                }
            ],
            "revision_plan": ["Review notes daily", "Practice problems regularly", "Create summary sheets"],
            "exam_tips":     ["Get good sleep before exam", "Practice past papers", "Review key concepts"]
        }
