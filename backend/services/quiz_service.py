from config import settings
from services.document_processor import DocumentProcessor
from models.global_models import get_llm
import json
import logging

logger = logging.getLogger(__name__)


class QuizService:
    """
    Quiz generation service using local Llama 3.
    Optimized for speed and quality.
    """
    
    def __init__(self):
        # Use global LLM instance
        self.llm = get_llm()
        self.doc_processor = DocumentProcessor()
    
    def generate_quiz(self, user_id: str, course_id: str, num_questions: int, 
                     difficulty: str, quiz_type: str):
        """Generate quiz from study materials using local LLM"""
        logger.info(f"Generating {num_questions} {difficulty} {quiz_type} questions")
        
        vector_store = self.doc_processor.get_vector_store(user_id, course_id)
        
        if not vector_store:
            raise ValueError("No documents found for this course. Please upload study materials first.")
        
        # Get diverse content samples (optimized retrieval)
        docs = vector_store.similarity_search("", k=min(10, num_questions * 2))
        context = "\n\n".join([doc.page_content for doc in docs[:5]])
        
        type_instruction = {
            "multiple_choice": "multiple choice questions with 4 options",
            "true_false": "true/false questions",
            "short_answer": "short answer questions",
            "mixed": "a mix of multiple choice, true/false, and short answer questions"
        }
        
        prompt = f"""You are creating a quiz for a student. Generate exactly {num_questions} questions.

Study Material:
{context}

Question type: {type_instruction.get(quiz_type, 'mixed')}
Difficulty: {difficulty.lower()}

CRITICAL: Return ONLY a JSON object, nothing else. No explanations, no markdown, just the JSON.

Format:
{{"questions": [{{"question": "Q?", "type": "multiple_choice", "options": ["A","B","C","D"], "correct_answer": "A", "explanation": "Why"}}]}}

For multiple choice: provide 4 options
For true/false: options are ["True", "False"]

Generate {num_questions} questions now:"""
        
        logger.info("Generating quiz with LLM...")
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
            
            # Try to parse
            result = json.loads(response_text)
            
            if "questions" in result and isinstance(result["questions"], list):
                logger.info(f"Successfully generated {len(result['questions'])} questions")
                return result["questions"]
            else:
                logger.error("Response missing 'questions' key or not a list")
                return self._parse_quiz_fallback(num_questions, quiz_type)
                
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse quiz JSON: {e}")
            logger.error(f"Response was: {response[:500]}")
            # Try to extract questions manually
            return self._extract_questions_from_text(response, num_questions, quiz_type)
        except Exception as e:
            logger.error(f"Unexpected error parsing quiz: {e}")
            return self._parse_quiz_fallback(num_questions, quiz_type)
    
    def _extract_questions_from_text(self, text: str, num_questions: int, quiz_type: str):
        """Try to extract questions from malformed JSON"""
        logger.warning("Attempting to extract questions from text")
        
        questions = []
        
        # Look for question patterns
        import re
        question_pattern = r'"question":\s*"([^"]+)"'
        type_pattern = r'"type":\s*"([^"]+)"'
        answer_pattern = r'"correct_answer":\s*"([^"]+)"'
        
        question_texts = re.findall(question_pattern, text)
        types = re.findall(type_pattern, text)
        answers = re.findall(answer_pattern, text)
        
        # Build questions from extracted data
        for i in range(min(len(question_texts), len(answers))):
            q_type = types[i] if i < len(types) else "multiple_choice"
            questions.append({
                "question": question_texts[i],
                "type": q_type,
                "options": ["Option A", "Option B", "Option C", "Option D"] if q_type == "multiple_choice" else ["True", "False"],
                "correct_answer": answers[i],
                "explanation": "Extracted from partial response"
            })
        
        if questions:
            logger.info(f"Extracted {len(questions)} questions from text")
            return questions
        
        return self._parse_quiz_fallback(num_questions, quiz_type)
    
    def _parse_quiz_fallback(self, num_questions: int, quiz_type: str):
        """Fallback parser if JSON fails"""
        logger.warning("Using fallback quiz generation")
        
        question_type = "multiple_choice" if quiz_type == "mixed" else quiz_type
        
        return [{
            "question": f"Sample question {i+1} from your study material",
            "type": question_type,
            "options": ["Option A", "Option B", "Option C", "Option D"] if question_type == "multiple_choice" else ["True", "False"],
            "correct_answer": "Option A" if question_type == "multiple_choice" else "True",
            "explanation": "This is a sample question. Please try generating again."
        } for i in range(num_questions)]
