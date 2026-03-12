from config import settings
from services.document_processor import DocumentProcessor
from models.global_models import get_llm, get_embeddings
import json
import logging
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger(__name__)


class QuizService:
    """
    Quiz generation service using local Llama 3.
    Optimized for speed and quality with proper answer validation.
    """
    
    def __init__(self):
        # Use global LLM instance
        self.llm = get_llm()
        self.embedding_model = get_embeddings()
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

CRITICAL INSTRUCTIONS:
1. Return ONLY a JSON object, nothing else. No explanations, no markdown, just the JSON.
2. For structural/short answer questions: provide COMPLETE, DETAILED answers, NOT "a,b,c,or d"
3. Always provide meaningful explanations for each question
4. For multiple choice: provide exactly 4 options labeled A, B, C, D
5. For true/false: options are ["True", "False"]
6. For short answer: provide complete answer text, not multiple choice options

Format:
{{"questions": [{{"question": "Q?", "type": "multiple_choice", "options": ["A","B","C","D"], "correct_answer": "A", "explanation": "Detailed explanation why this is correct"}}]}}

EXAMPLES:
Multiple Choice:
{{"question": "What is photosynthesis?", "type": "multiple_choice", "options": ["Process of making food using sunlight", "Process of breathing", "Process of digestion", "Process of reproduction"], "correct_answer": "Process of making food using sunlight", "explanation": "Photosynthesis is the process by which plants convert sunlight, carbon dioxide, and water into glucose and oxygen."}}

Short Answer:
{{"question": "Explain the water cycle", "type": "short_answer", "options": [], "correct_answer": "The water cycle involves evaporation of water from oceans and lakes, condensation into clouds, precipitation as rain or snow, and collection back into water bodies. This continuous process is driven by solar energy.", "explanation": "The water cycle is a continuous process that recycles water through evaporation, condensation, precipitation, and collection phases."}}

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
                # Validate and fix questions
                fixed_questions = self._validate_and_fix_questions(result["questions"])
                logger.info(f"Successfully generated {len(fixed_questions)} questions")
                return fixed_questions
            else:
                logger.error("Response missing 'questions' key or not a list")
                return self._parse_quiz_fallback(num_questions, quiz_type)
                
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse quiz JSON: {e}")
            logger.error(f"Response was: {response[:500]}")
            # Try to extract questions manually
            extracted = self._extract_questions_from_text(response, num_questions, quiz_type)
            return self._validate_and_fix_questions(extracted)
        except Exception as e:
            logger.error(f"Unexpected error parsing quiz: {e}")
            return self._parse_quiz_fallback(num_questions, quiz_type)
    
    def evaluate_quiz(self, questions: list, user_answers: dict) -> dict:
        """
        Evaluate quiz answers with semantic understanding for structural questions.
        Returns detailed results with explanations.
        """
        logger.info(f"Evaluating quiz with {len(questions)} questions")
        
        results = {
            "total_questions": len(questions),
            "correct_answers": 0,
            "score_percentage": 0,
            "question_results": []
        }
        
        for idx, question in enumerate(questions):
            user_answer = user_answers.get(str(idx), "").strip()
            correct_answer = question.get("correct_answer", "").strip()
            question_type = question.get("type", "multiple_choice")
            
            # Evaluate based on question type
            is_correct = False
            feedback = ""
            
            if question_type in ["multiple_choice", "true_false"]:
                # Exact match for MCQ and True/False
                is_correct = self._exact_match_evaluation(user_answer, correct_answer)
                feedback = "Exact match evaluation"
                
            elif question_type in ["short_answer", "structural"]:
                # Semantic similarity for structural questions
                is_correct, similarity_score = self._semantic_evaluation(user_answer, correct_answer)
                feedback = f"Semantic similarity: {similarity_score:.2f}"
                
            else:
                # Default to exact match
                is_correct = self._exact_match_evaluation(user_answer, correct_answer)
                feedback = "Default exact match evaluation"
            
            if is_correct:
                results["correct_answers"] += 1
            
            # Build question result
            question_result = {
                "question_number": idx + 1,
                "question": question.get("question", ""),
                "user_answer": user_answer,
                "correct_answer": correct_answer,
                "is_correct": bool(is_correct),  # Ensure Python boolean
                "explanation": question.get("explanation", "No explanation provided"),
                "feedback": feedback,
                "type": question_type
            }
            
            results["question_results"].append(question_result)
        
        # Calculate percentage
        if results["total_questions"] > 0:
            results["score_percentage"] = round(
                (results["correct_answers"] / results["total_questions"]) * 100, 1
            )
        
        logger.info(f"Quiz evaluation complete: {results['correct_answers']}/{results['total_questions']} ({results['score_percentage']}%)")
        return results
    
    def _exact_match_evaluation(self, user_answer: str, correct_answer: str) -> bool:
        """Exact match evaluation for MCQ and True/False questions"""
        if not user_answer or not correct_answer:
            return False
        
        # Normalize answers for comparison
        user_normalized = user_answer.lower().strip()
        correct_normalized = correct_answer.lower().strip()
        
        # Direct match
        if user_normalized == correct_normalized:
            return True
        
        # Handle common variations
        # For True/False questions
        if correct_normalized in ["true", "false"]:
            return user_normalized == correct_normalized
        
        # For MCQ options, check if user selected the correct option
        # Handle cases where correct_answer might be "A" but user_answer is "Option A"
        if len(correct_normalized) == 1 and correct_normalized.isalpha():
            # Correct answer is like "A", check if user answer contains it
            return correct_normalized in user_normalized.lower()
        
        return False
    
    def _semantic_evaluation(self, user_answer: str, correct_answer: str, threshold: float = 0.57) -> tuple:
        """
        Semantic similarity evaluation for structural questions.
        Returns (is_correct, similarity_score)
        """
        if not user_answer or not correct_answer:
            return False, 0.0
        
        if not user_answer.strip() or not correct_answer.strip():
            return False, 0.0
        
        try:
            # Get embeddings for both answers using HuggingFaceEmbeddings
            user_embedding = self.embedding_model.embed_query(user_answer.strip())
            correct_embedding = self.embedding_model.embed_query(correct_answer.strip())
            
            # Convert to numpy arrays and reshape for cosine similarity
            user_vec = np.array(user_embedding).reshape(1, -1)
            correct_vec = np.array(correct_embedding).reshape(1, -1)
            
            # Calculate cosine similarity
            similarity = cosine_similarity(user_vec, correct_vec)[0][0]
            
            # Convert numpy types to Python types for serialization
            similarity_score = float(similarity)
            is_correct = bool(similarity_score >= threshold)
            
            logger.info(f"Semantic evaluation: similarity={similarity_score:.3f}, threshold={threshold}, correct={is_correct}")
            return is_correct, similarity_score
            
        except Exception as e:
            logger.error(f"Error in semantic evaluation: {e}")
            # Fallback to simple text comparison
            user_words = set(user_answer.lower().split())
            correct_words = set(correct_answer.lower().split())
            
            if not user_words or not correct_words:
                return False, 0.0
            
            # Jaccard similarity as fallback
            intersection = len(user_words.intersection(correct_words))
            union = len(user_words.union(correct_words))
            jaccard_sim = intersection / union if union > 0 else 0.0
            
            return bool(jaccard_sim >= 0.5), float(jaccard_sim)
    
    def _extract_questions_from_text(self, text: str, num_questions: int, quiz_type: str):
        """Try to extract questions from malformed JSON"""
        logger.warning("Attempting to extract questions from text")
        
        questions = []
        
        # Look for question patterns
        import re
        question_pattern = r'"question":\s*"([^"]+)"'
        type_pattern = r'"type":\s*"([^"]+)"'
        answer_pattern = r'"correct_answer":\s*"([^"]+)"'
        explanation_pattern = r'"explanation":\s*"([^"]+)"'
        
        question_texts = re.findall(question_pattern, text)
        types = re.findall(type_pattern, text)
        answers = re.findall(answer_pattern, text)
        explanations = re.findall(explanation_pattern, text)
        
        # Build questions from extracted data
        for i in range(min(len(question_texts), num_questions)):
            q_type = types[i] if i < len(types) else "multiple_choice"
            answer = answers[i] if i < len(answers) else "A"
            explanation = explanations[i] if i < len(explanations) else "No explanation provided"
            
            questions.append({
                "question": question_texts[i],
                "type": q_type,
                "options": ["Option A", "Option B", "Option C", "Option D"] if q_type == "multiple_choice" else ["True", "False"],
                "correct_answer": answer,
                "explanation": explanation
            })
        
        if questions:
            logger.info(f"Extracted {len(questions)} questions from text")
            return questions
        
        return self._parse_quiz_fallback(num_questions, quiz_type)
    
    def _validate_and_fix_questions(self, questions: list) -> list:
        """Validate and fix questions to ensure all required fields are present"""
        fixed_questions = []
        
        for i, q in enumerate(questions):
            # Ensure all required fields exist with defaults
            question_type = q.get("type", "multiple_choice")
            
            # Set appropriate options based on type
            if question_type == "multiple_choice":
                default_options = ["Option A", "Option B", "Option C", "Option D"]
                default_answer = "Option A"
            elif question_type == "true_false":
                default_options = ["True", "False"]
                default_answer = "True"
            else:  # short_answer, structural
                default_options = []
                default_answer = "Please provide a complete answer based on the study material."
            
            fixed_q = {
                "question": q.get("question", f"Question {i+1}"),
                "type": question_type,
                "options": q.get("options", default_options),
                "correct_answer": q.get("correct_answer", default_answer),
                "explanation": q.get("explanation", "No explanation provided")
            }
            
            # Validate question is not empty
            if not fixed_q["question"] or fixed_q["question"].strip() == "":
                continue
            
            # Ensure options is a list
            if not isinstance(fixed_q["options"], list):
                fixed_q["options"] = default_options
            
            # Fix structural questions that have MCQ-style answers
            if question_type in ["short_answer", "structural"]:
                # Check if correct_answer looks like MCQ option
                correct_answer = fixed_q["correct_answer"].strip()
                if (len(correct_answer) <= 3 and correct_answer.upper() in ["A", "B", "C", "D"]) or \
                   correct_answer.lower() in ["a,b,c,or d", "a, b, c, or d"]:
                    # This is a structural question with MCQ-style answer, fix it
                    fixed_q["correct_answer"] = "Please provide a detailed answer based on the study material and concepts discussed."
                    fixed_q["explanation"] = "This question requires a comprehensive written response demonstrating understanding of the concepts."
                
                # Ensure options is empty for structural questions
                fixed_q["options"] = []
            
            # Ensure correct_answer exists and is meaningful
            if not fixed_q["correct_answer"] or fixed_q["correct_answer"].strip() == "":
                if question_type == "multiple_choice":
                    fixed_q["correct_answer"] = fixed_q["options"][0] if fixed_q["options"] else "A"
                elif question_type == "true_false":
                    fixed_q["correct_answer"] = "True"
                else:
                    fixed_q["correct_answer"] = "Please provide a complete answer."
            
            # Ensure explanation exists and is meaningful
            if not fixed_q["explanation"] or fixed_q["explanation"].strip() == "" or fixed_q["explanation"] == "Why":
                fixed_q["explanation"] = f"This question tests understanding of key concepts from the study material."
            
            fixed_questions.append(fixed_q)
        
        return fixed_questions
    
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
