from config import settings
from models.global_models import get_llm
from datetime import datetime
from services.document_processor import DocumentProcessor
from services.concept_service import concept_service
import json
import logging

logger = logging.getLogger(__name__)


class PlannerService:
    """
    Study planner service using local LLM.
    Supports smart plan generation and automated topic discovery.
    """
    
    def __init__(self):
        # Use global LLM instance
        self.llm = get_llm()
        self.doc_processor = DocumentProcessor()
    
    def create_study_plan(self, user_id: str, course_name: str, exam_date: str, topics: list):
        """Generate personalized study plan using local LLM with mastery adaptation"""
        logger.info(f"Creating mastery-adaptive study plan for {course_name}")
        
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Get mastery context
        mastery_context = concept_service.get_summary_context_for_mastery(user_id, course_name)
        
        prompt_prefix = f"USER MASTERY DATA:\n{mastery_context}\nPlease prioritize allocating more study days/hours to 'WEAK' concepts.\n\n" if mastery_context else ""
        
        prompt = f"""{prompt_prefix}Create a study plan for a student.

Course: {course_name}
Exam Date: {exam_date}
Today: {today}
Topics: {', '.join(topics)}

CRITICAL: Return ONLY a JSON object, nothing else. No explanations, no markdown, just the JSON.
Keep the plan concise (maximum of 2 weeks detailed, 1-2 tasks per day) to ensure rapid loading times.

Format:
{{"weeks": [{{"week_number": 1, "focus": "Topic", "days": [{{"day": "Monday", "tasks": ["Task"], "duration": "2h"}}]}}], "revision_plan": ["Tip"], "exam_tips": ["Tip"]}}

Generate the plan now:"""
        
        logger.info("Generating study plan with LLM...")
        response = self.llm.invoke(prompt)
        
        try:
            # Extract JSON from response (handle extra text)
            response_text = response.strip()
            
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
