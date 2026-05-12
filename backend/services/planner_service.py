from config import settings
from typing import Optional
from pathlib import Path
from models.global_models import get_llm
from datetime import datetime
from services.document_processor import DocumentProcessor
from services.concept_service import concept_service
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
        # Doc processor is global/stateless enough
        self.doc_processor = DocumentProcessor()
    
    def create_study_plan(self, user_id: str, course_id: str, course_name: str, exam_date: str, topics: list, focus_topic: Optional[str] = None, api_key: Optional[str] = None):
        """Generate personalized study plan using local LLM with mastery adaptation"""
        logger.info(f"Creating mastery-adaptive study plan for {course_name} ({course_id}){f' focused on topic: {focus_topic}' if focus_topic else ''}")
        
        # Get appropriate LLM
        llm = get_llm(api_key)
        
        today_dt = datetime.now()
        today = today_dt.strftime("%Y-%m-%d")
        
        # Calculate duration until exam
        try:
            exam_dt = datetime.strptime(exam_date, "%Y-%m-%d")
            delta = exam_dt - today_dt
            days_until = delta.days
            weeks_until = max(1, (days_until // 7) + 1)
            # Cap to prevent LLM overload
            plan_weeks = min(12, weeks_until)
            duration_text = f"{plan_weeks} weeks ({days_until} days)"
        except Exception:
            plan_weeks = 2
            duration_text = "2 weeks"
        
        # Get mastery context — use course_id for DB lookup
        mastery_context = concept_service.get_summary_context_for_mastery(user_id, course_id)
        
        # Get preferred language
        preferred_language = "en"
        if user_id.isdigit():
            preferred_language = auth_db.get_preferred_language(int(user_id))
            
        # Build prompt prefix with mastery awareness and topic focus
        prompt_prefix = ""
        if focus_topic:
            prompt_prefix = f"TOPIC FOCUS: Create a study plan that PRIORITIZES '{focus_topic}'. Allocate more time and tasks to this specific topic.\n\n"
        if mastery_context:
            prompt_prefix += f"USER MASTERY DATA:\n{mastery_context}\nPlease prioritize allocating more study days/hours to 'WEAK' concepts.\n\n"
        
        prompt_prefix += f"LANGUAGE INSTRUCTION: The user's preferred language is: {preferred_language}. Generate ALL study plan content (Focus, Tasks, Revision Plan, and Exam Tips) entirely in {preferred_language}. If the course material or topics are in a different language, act as a professional translator.\n\n"

        
        prompt = f"""{prompt_prefix}Create a comprehensive study plan for a student.
        
Course: {course_name}
Duration: {duration_text}
Start Date (Today): {today}
Exam Date: {exam_date}
Topics: {', '.join(topics)}

CRITICAL: Return ONLY a JSON object. No markdown, no extra text.
The plan MUST start from today ({today}) and be organized by date.

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
        
        logger.info("Generating study plan with LLM...")
        response = llm.invoke(prompt)
        
        # Extract text content (handles both strings from Ollama and objects from Groq)
        response_text = response if isinstance(response, str) else getattr(response, 'content', str(response))
        
        try:
            # Extract JSON from response (handle extra text)
            response_text = response_text.strip()
            
            # Remove markdown code blocks
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0]
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0]
            
            # Find JSON object boundaries
            start_idx = response_text.find("{")
            end_idx = response_text.rfind("}")
            
            if start_idx != -1 and end_idx != -1:
                response_text = response_text[start_idx:end_idx+1]
            
            response_text = response_text.strip()
            
            result = json.loads(response_text)
            logger.info("Study plan generated successfully")
            return result
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse study plan JSON: {e}")
            logger.error(f"Response was: {response[:500]}")
            return self._fallback_study_plan(course_name, topics)
        except Exception as e:
            logger.error(f"Unexpected error parsing study plan: {e}")
            return self._fallback_study_plan(course_name, topics)
    
    def discover_topics(self, user_id: str, course_id: str):
        """Discover potential study topics by analyzing course documents"""
        logger.info(f"Discovering topics for course {course_id}")
        
        user_dir = Path(get_absolute_path(settings.UPLOAD_DIR)) / user_id / course_id
        if not user_dir.exists():
            return []
            
        all_concepts = []
        # Analyze up to 5 documents to find topics
        docs = [f for f in user_dir.iterdir() if f.is_file() and not f.name.endswith(".json")]
        
        for doc_path in docs[:5]:
            try:
                # Extract text from first 2000 chars
                text = self.doc_processor.extract_text(str(doc_path))
                if text:
                    concepts = concept_service.extract_concepts_from_text(text[:2000])
                    all_concepts.extend(concepts)
            except:
                continue
                
        # Unique and limit
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
                        {"day": "Monday", "tasks": ["Review lecture notes"], "duration": "2 hours"},
                        {"day": "Wednesday", "tasks": ["Practice problems"], "duration": "2 hours"},
                        {"day": "Friday", "tasks": ["Review and quiz"], "duration": "1.5 hours"}
                    ]
                }
            ],
            "revision_plan": ["Review notes daily", "Practice problems regularly", "Create summary sheets"],
            "exam_tips": ["Get good sleep before exam", "Practice past papers", "Review key concepts"]
        }
