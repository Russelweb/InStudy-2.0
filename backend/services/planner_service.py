from config import settings
from models.global_models import get_llm
from datetime import datetime
import json
import logging

logger = logging.getLogger(__name__)


class PlannerService:
    """
    Study planner service using local Llama 3.
    Optimized for speed and quality.
    """
    
    def __init__(self):
        # Use global LLM instance
        self.llm = get_llm()
    
    def create_study_plan(self, course_name: str, exam_date: str, topics: list):
        """Generate personalized study plan using local LLM"""
        logger.info(f"Creating study plan for {course_name}")
        
        today = datetime.now().strftime("%Y-%m-%d")
        
        prompt = f"""Create a study plan for a student.

Course: {course_name}
Exam Date: {exam_date}
Today: {today}
Topics: {', '.join(topics)}

CRITICAL: Return ONLY a JSON object, nothing else. No explanations, no markdown, just the JSON.

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
