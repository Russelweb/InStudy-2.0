from config import settings
from typing import Optional, List, Dict, Tuple
from services.document_processor import DocumentProcessor
from services.concept_service import concept_service
from models.global_models import get_llm, get_embeddings
import json
import logging
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from database.auth_db import auth_db

logger = logging.getLogger(__name__)

def _get_adaptive_quiz_subtopics(user_id: str, course_id: str,
                                  num_questions: int) -> Tuple[List[Dict], str]:
    """
    Build an adaptive subtopic selection for quiz generation.

    Priority order:
      1. Subtopics with zero quiz XP (never quizzed) — guaranteed slot
      2. Subtopics with lowest mastery % — weighted more questions
      3. Core weight subtopics before peripheral

    Returns (subtopics_list, search_query_string)
    """
    try:
        from database.mastery_v2_db import mastery_v2_db
        subtopics = mastery_v2_db.get_weakest_subtopics(
            user_id, course_id, limit=num_questions * 4
        )
        if not subtopics:
            return [], ""

        # Guaranteed: subtopics never quizzed
        never_quizzed = [s for s in subtopics if s.get("quiz_xp", 0) == 0]
        weak = [s for s in subtopics if s.get("quiz_xp", 0) > 0]

        # Build search query from top weak subtopics
        query_terms = [s["concept_name"] for s in (never_quizzed + weak)[:6]]
        search_query = " ".join(query_terms)

        return subtopics, search_query
    except Exception as e:
        logger.warning(f"Adaptive quiz subtopics failed: {e}")
        return [], ""


class QuizService:
    """
    Quiz generation service using local Llama 3.
    Optimized for speed and quality with proper answer validation.
    """
    
    def __init__(self):
        # Embeddings and doc processor are global/stateless enough
        self.embedding_model = get_embeddings()
        self.doc_processor = DocumentProcessor()
    
    def generate_quiz(self, user_id: str, course_id: str, num_questions: int, 
                     difficulty: str, quiz_type: str, topic: Optional[str] = None, api_key: Optional[str] = None):
        """Generate quiz from study materials using local LLM"""
        logger.info(f"Generating {num_questions} {difficulty} {quiz_type} questions with mastery awareness{f' for topic: {topic}' if topic else ''}")
        
        llm = get_llm(api_key)
        vector_store = self.doc_processor.get_vector_store(user_id, course_id)
        if not vector_store:
            raise ValueError("No documents found for this course. Please upload study materials first.")

        # ── Mastery V2: adaptive subtopic selection ──────────────────────────
        adaptive_subtopics, adaptive_query = [], ""
        subtopic_lookup: Dict[str, Dict] = {}

        if not topic:
            adaptive_subtopics, adaptive_query = _get_adaptive_quiz_subtopics(
                user_id, course_id, num_questions
            )
            if adaptive_subtopics:
                for st in adaptive_subtopics:
                    subtopic_lookup[st["concept_name"].lower()] = {
                        "concept_id": st["concept_id"],
                        "doc_id": st["doc_id"],
                    }

                # Build mastery context for prompt
                never_quizzed = [s["concept_name"] for s in adaptive_subtopics
                                 if s.get("quiz_xp", 0) == 0][:8]
                weak_names = [s["concept_name"] for s in adaptive_subtopics
                              if s.get("mastery_pct", 0) < 40 and s.get("quiz_xp", 0) > 0][:8]
                mastery_context = ""
                if never_quizzed:
                    mastery_context += f"NEVER QUIZZED (must include): {', '.join(never_quizzed)}\n"
                if weak_names:
                    mastery_context += f"WEAK CONCEPTS (prioritize): {', '.join(weak_names)}\n"
                logger.info(f"Adaptive quiz: {len(never_quizzed)} never-quizzed, {len(weak_names)} weak")
            else:
                mastery_context = ""
        else:
            mastery_context = ""
        # ────────────────────────────────────────────────────────────────────

        # ── Legacy mastery fallback ──────────────────────────────────────────
        if not mastery_context and not topic:
            legacy_context = concept_service.get_summary_context_for_mastery(user_id, course_id)
            mastery_context = legacy_context if legacy_context else ""
        # ────────────────────────────────────────────────────────────────────

        # Search query
        if topic:
            search_query = topic
        elif adaptive_query:
            search_query = adaptive_query
        else:
            search_query = ""
            if "WEAK IN" in mastery_context:
                try:
                    search_query = mastery_context.split("WEAK IN (Expand these):")[1].split("\n")[0].strip()
                except: pass

        docs = vector_store.similarity_search(search_query, k=min(5, max(3, num_questions // 2)))
        context = "\n\n".join([doc.page_content for doc in docs[:3]])
        
        # Get preferred language
        preferred_language = "English"
        if user_id.isdigit():
            preferred_language = auth_db.get_preferred_language(int(user_id))
        
        type_instruction = {
            "multiple_choice": "multiple choice questions with 4 options",
            "true_false": "true/false questions",
            "short_answer": "short answer questions",
            "mixed": "a mix of multiple choice, true/false, and short answer questions"
        }

        prompt_prefix = ""
        if topic:
            prompt_prefix = f"TOPIC FOCUS: Generate quiz questions EXCLUSIVELY about '{topic}'. All questions must be directly related to this specific topic.\n\n"
        if mastery_context:
            prompt_prefix += f"USER MASTERY DATA:\n{mastery_context}\nPrioritize concepts listed as NEVER QUIZZED and WEAK above.\n\n"

        prompt_prefix += f"LANGUAGE INSTRUCTION (MANDATORY): The user's preferred language is: {preferred_language}. Generate ALL quiz content entirely in {preferred_language}.\n\n"

        prompt = f"""{prompt_prefix}You are creating a quiz for a student. Generate exactly {num_questions} questions.

Study Material:
{context}

Question type: {type_instruction.get(quiz_type, 'mixed')}
Difficulty: {difficulty.lower()}

CRITICAL INSTRUCTIONS:
1. Return ONLY a valid JSON object, nothing else. No markdown or explanations outside the JSON.
2. DO NOT add trailing commas.
3. For EVERY question, include a "concept" field that identifies the 1-2 word main topic (match exactly to the NEVER QUIZZED/WEAK concepts listed above when possible).
4. For EVERY explanation, provide a detailed educational note (3-4 sentences).
5. For multiple choice: exactly 4 options, and correct_answer must be one of the option values.
6. For true/false: options must be ["True", "False"], and correct_answer must be "True" or "False".
7. For short_answer: options must be [] (empty list), and correct_answer MUST be a complete, detailed, exemplary correct answer (1-3 sentences) derived from the study material. Do not use placeholders or generic statements.
8. For mixed type: ensure a balanced variety.

JSON Format Template:
{{
  "questions": [
    {{
      "question": "What is the capital of France?",
      "type": "multiple_choice",
      "options": ["London", "Paris", "Berlin", "Rome"],
      "correct_answer": "Paris",
      "explanation": "Paris is the capital and most populous city of France...",
      "concept": "Capital Cities"
    }},
    {{
      "question": "What is photosynthesis?",
      "type": "short_answer",
      "options": [],
      "correct_answer": "Photosynthesis is the process by which green plants and some other organisms use sunlight to synthesize nutrients from carbon dioxide and water.",
      "explanation": "Photosynthesis is crucial for life on Earth as it converts solar energy into chemical energy and produces oxygen...",
      "concept": "Photosynthesis"
    }}
  ]
}}

Generate {num_questions} questions now:"""

        logger.info("Generating quiz with LLM...")
        response = llm.invoke(prompt)
        response_text = response if isinstance(response, str) else getattr(response, 'content', str(response))

        if not response_text:
            return self._parse_quiz_fallback(num_questions, quiz_type)

        try:
            response_text = response_text.strip()
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0]
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0]

            start_idx = response_text.find("{")
            end_idx = response_text.rfind("}")
            if start_idx != -1 and end_idx != -1:
                response_text = response_text[start_idx:end_idx+1]

            import re
            response_text = re.sub(r',\s*}', '}', response_text)
            response_text = re.sub(r',\s*]', ']', response_text)

            result = json.loads(response_text.strip())

            if "questions" in result and isinstance(result["questions"], list):
                fixed_questions = self._validate_and_fix_questions(result["questions"])

                # ── Tag each question with subtopic_id from V2 concept graph ──
                for q in fixed_questions:
                    concept_label = q.get("concept", "").lower().strip()
                    matched = subtopic_lookup.get(concept_label)
                    if not matched:
                        for name, meta in subtopic_lookup.items():
                            if concept_label in name or name in concept_label:
                                matched = meta
                                break
                    if matched:
                        q["subtopic_id"] = matched["concept_id"]
                        q["doc_id"] = matched["doc_id"]
                    else:
                        q["subtopic_id"] = None
                        q["doc_id"] = None
                # ─────────────────────────────────────────────────────────────

                for q in fixed_questions:
                    q["explanation"] = q.get("explanation", "") + "\n\n*(Note: InStudy AI can make mistakes. Please verify.)*"

                logger.info(f"Successfully generated {len(fixed_questions)} questions")
                logger.info(f"Sample concepts: {[q.get('concept') for q in fixed_questions[:3]]}")
                return fixed_questions
            else:
                return self._parse_quiz_fallback(num_questions, quiz_type)

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse quiz JSON: {e}")
            extracted = self._extract_questions_from_text(response, num_questions, quiz_type)
            return self._validate_and_fix_questions(extracted)
        except Exception as e:
            logger.error(f"Unexpected error parsing quiz: {e}")
            return self._parse_quiz_fallback(num_questions, quiz_type)
    
    def evaluate_quiz(self, questions: list, user_answers: dict, api_key: Optional[str] = None) -> dict:
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
        
        # Instantiate LLM once for evaluations
        llm = get_llm(api_key)
        
        for idx, question in enumerate(questions):
            user_answer = user_answers.get(str(idx), "").strip()
            raw_correct = question.get("correct_answer", "").strip()
            options = question.get("options", [])
            question_type = question.get("type", "multiple_choice")
            
            # ── Resolve letter answers to full option text ────────────────────
            # LLM sometimes returns "C" instead of the actual option text.
            # Resolve it so both display AND evaluation use the full text.
            correct_answer = raw_correct
            if (
                options
                and len(raw_correct) <= 2
                and raw_correct.upper() in ['A', 'B', 'C', 'D', 'E', 'F']
            ):
                letter_index = ord(raw_correct.upper()) - ord('A')
                if 0 <= letter_index < len(options):
                    correct_answer = options[letter_index]
                    logger.info(f"Resolved letter answer '{raw_correct}' → '{correct_answer}'")
            # ─────────────────────────────────────────────────────────────────
            
            # Evaluate based on question type
            is_correct = False
            feedback = ""
            explanation = question.get("explanation", "No explanation provided")
            
            if question_type in ["multiple_choice", "true_false"]:
                is_correct = self._exact_match_evaluation(user_answer, correct_answer)
                # Also try matching against the raw letter in case user sent letter
                if not is_correct and raw_correct != correct_answer:
                    is_correct = self._exact_match_evaluation(user_answer, raw_correct)
                feedback = "Exact match evaluation"
                
            elif question_type in ["short_answer", "structural"]:
                ai_success = False
                try:
                    is_correct, similarity_score, ai_feedback = self._ai_evaluation(
                        question=question.get("question", ""),
                        user_answer=user_answer,
                        correct_answer=correct_answer,
                        llm=llm
                    )
                    feedback = f"AI Evaluated ({similarity_score:.2f}): {ai_feedback}"
                    if ai_feedback:
                        explanation = f"**AI Grading Feedback:** {ai_feedback}\n\n{explanation}"
                    ai_success = True
                except Exception as e:
                    logger.warning(f"AI evaluation failed, falling back to local semantic evaluation: {e}")
                    
                if not ai_success:
                    is_correct, similarity_score = self._semantic_evaluation(user_answer, correct_answer)
                    feedback = f"Semantic similarity fallback: {similarity_score:.2f}"
                
            else:
                is_correct = self._exact_match_evaluation(user_answer, correct_answer)
                feedback = "Default exact match evaluation"
            
            if is_correct:
                results["correct_answers"] += 1
            
            question_result = {
                "question_number": idx + 1,
                "question": question.get("question", ""),
                "user_answer": user_answer,
                "correct_answer": correct_answer,   # always the full text now
                "is_correct": bool(is_correct),
                "explanation": explanation,
                "feedback": feedback,
                "type": question_type,
                "concept": question.get("concept"),
                "options": options,
            }
            
            results["question_results"].append(question_result)
        
        if results["total_questions"] > 0:
            results["score_percentage"] = round(
                (results["correct_answers"] / results["total_questions"]) * 100, 1
            )
        
        logger.info(f"Quiz evaluation complete: {results['correct_answers']}/{results['total_questions']} ({results['score_percentage']}%)")
        return results

    def _ai_evaluation(self, question: str, user_answer: str, correct_answer: str, llm) -> tuple:
        """
        Evaluate short answer using the AI model.
        Returns (is_correct, score, feedback)
        """
        if not user_answer or not user_answer.strip():
            return False, 0.0, "No answer was provided."
            
        prompt = f"""You are an expert grading assistant. Evaluate the user's answer to a short answer question against the correct reference answer.
Be flexible: the user does not need to match the reference answer word-for-word. They should be marked correct if their answer is semantically accurate, shows a correct understanding, and captures the core concept(s), even if they use different vocabulary, phrasing, or have minor spelling/grammar mistakes.

Question: {question}
Reference Answer: {correct_answer}
User's Answer: {user_answer}

Return ONLY a valid JSON object with the following fields:
- "is_correct": boolean (true if the user's answer is correct/acceptable, false otherwise)
- "score": number between 0.0 and 1.0 (where 1.0 is perfect agreement and 0.0 is completely wrong/irrelevant)
- "feedback": string (1-2 sentences explaining why the answer was marked correct or incorrect, pointing out what was correct or missing)

Do not include any other text, markdown formatting (like ```json), or explanations outside the JSON object."""

        try:
            logger.info("Evaluating short answer with LLM...")
            response = llm.invoke(prompt)
            response_text = response if isinstance(response, str) else getattr(response, 'content', str(response))
            
            if not response_text:
                raise ValueError("Empty response from LLM")
                
            response_text = response_text.strip()
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0]
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0]

            start_idx = response_text.find("{")
            end_idx = response_text.rfind("}")
            if start_idx != -1 and end_idx != -1:
                response_text = response_text[start_idx:end_idx+1]
                
            import re
            response_text = re.sub(r',\s*}', '}', response_text)
            
            result = json.loads(response_text.strip())
            is_correct = bool(result.get("is_correct", False))
            score = float(result.get("score", 0.0))
            feedback = str(result.get("feedback", ""))
            
            logger.info(f"AI evaluation complete: is_correct={is_correct}, score={score}, feedback='{feedback}'")
            return is_correct, score, feedback
        except Exception as e:
            logger.error(f"Error in AI quiz evaluation: {e}")
            raise e
    
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
    
    def _semantic_evaluation(self, user_answer: str, correct_answer: str, threshold: float = 0.42) -> tuple:
        """
        Multi-strategy evaluation for short answer questions.
        Tries three approaches in order:
          1. Embedding cosine similarity (lowered threshold to 0.42)
          2. Keyword overlap (if embeddings produce low score)
          3. Substring containment (for very short correct answers)
        Returns (is_correct, similarity_score)
        """
        if not user_answer or not correct_answer:
            return False, 0.0
        if not user_answer.strip() or not correct_answer.strip():
            return False, 0.0

        user_clean   = user_answer.strip().lower()
        correct_clean = correct_answer.strip().lower()

        # ── Strategy 3: substring containment (fast, handles concise answers) ──
        # If the correct answer is short and the user's answer contains it verbatim
        if len(correct_clean) < 80 and correct_clean in user_clean:
            logger.info("Short answer evaluation: substring match → correct")
            return True, 1.0

        # ── Strategy 2: keyword overlap ────────────────────────────────────────
        def meaningful_words(text):
            stop = {"the","a","an","is","are","was","were","be","been","being",
                    "have","has","had","do","does","did","will","would","shall",
                    "should","may","might","must","can","could","to","of","in",
                    "on","at","by","for","with","about","as","into","through",
                    "and","or","but","if","because","so","that","this","it","its"}
            return set(w.strip('.,;:!?') for w in text.split() if len(w) > 2 and w not in stop)

        user_words    = meaningful_words(user_clean)
        correct_words = meaningful_words(correct_clean)

        if correct_words:
            overlap_ratio = len(user_words & correct_words) / len(correct_words)
            if overlap_ratio >= 0.45:
                logger.info(f"Short answer evaluation: keyword overlap {overlap_ratio:.2f} → correct")
                return True, overlap_ratio

        # ── Strategy 1: embedding cosine similarity ────────────────────────────
        try:
            user_embedding    = self.embedding_model.embed_query(user_answer.strip())
            correct_embedding = self.embedding_model.embed_query(correct_answer.strip())
            user_vec    = np.array(user_embedding).reshape(1, -1)
            correct_vec = np.array(correct_embedding).reshape(1, -1)
            similarity  = float(cosine_similarity(user_vec, correct_vec)[0][0])
            is_correct  = bool(similarity >= threshold)
            logger.info(f"Short answer evaluation: cosine={similarity:.3f}, threshold={threshold}, correct={is_correct}")
            return is_correct, similarity
        except Exception as e:
            logger.error(f"Embedding evaluation error: {e}")
            # Final fallback: Jaccard similarity
            if user_words and correct_words:
                jaccard = len(user_words & correct_words) / len(user_words | correct_words)
                return bool(jaccard >= 0.3), float(jaccard)
            return False, 0.0
    
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
        concept_pattern = r'"concept":\s*"([^"]+)"'
        
        question_texts = re.findall(question_pattern, text)
        types = re.findall(type_pattern, text)
        answers = re.findall(answer_pattern, text)
        explanations = re.findall(explanation_pattern, text)
        concepts = re.findall(concept_pattern, text)
        
        # Build questions from extracted data
        for i in range(min(len(question_texts), num_questions)):
            q_type = types[i] if i < len(types) else "multiple_choice"
            answer = answers[i] if i < len(answers) else "A"
            explanation = explanations[i] if i < len(explanations) else "No explanation provided"
            concept = concepts[i] if i < len(concepts) else "General"
            
            questions.append({
                "question": question_texts[i],
                "type": q_type,
                "options": ["Option A", "Option B", "Option C", "Option D"] if q_type == "multiple_choice" else ["True", "False"],
                "correct_answer": answer,
                "explanation": explanation,
                "concept": concept
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
                default_answer = ""
            
            fixed_q = {
                "question": str(q.get("question", f"Question {i+1}")),
                "type": question_type,
                "options": q.get("options", default_options),
                "correct_answer": str(q.get("correct_answer", default_answer)).strip(),
                "explanation": str(q.get("explanation", "No explanation provided")),
                "concept": str(q.get("concept", "General"))
            }
            
            # Validate question is not empty
            if not fixed_q["question"] or fixed_q["question"].strip() == "":
                continue
            
            # Ensure options is a list
            if not isinstance(fixed_q["options"], list):
                fixed_q["options"] = default_options
            
            # Fix structural/short answer questions that have MCQ-style answers or placeholders
            if question_type in ["short_answer", "structural"]:
                correct_answer = fixed_q["correct_answer"]
                if (
                    not correct_answer
                    or (len(correct_answer) <= 3 and correct_answer.upper() in ["A", "B", "C", "D", "TRUE", "FALSE"])
                    or correct_answer.lower() in ["a,b,c,or d", "a, b, c, or d"]
                    or "please provide a" in correct_answer.lower()
                    or "complete answer" in correct_answer.lower()
                ):
                    # Use explanation as a fallback correct answer
                    if fixed_q["explanation"] and fixed_q["explanation"] != "No explanation provided" and len(fixed_q["explanation"]) > 10:
                        fixed_q["correct_answer"] = fixed_q["explanation"]
                    else:
                        fixed_q["correct_answer"] = "Please provide a detailed response describing the main concept."
                
                # Ensure options is empty for structural questions
                fixed_q["options"] = []
            
            # Ensure correct_answer exists and is meaningful for all types
            if not fixed_q["correct_answer"] or fixed_q["correct_answer"].strip() == "":
                if question_type == "multiple_choice":
                    fixed_q["correct_answer"] = fixed_q["options"][0] if fixed_q["options"] else "Option A"
                elif question_type == "true_false":
                    fixed_q["correct_answer"] = "True"
                else:
                    if fixed_q["explanation"] and fixed_q["explanation"] != "No explanation provided" and len(fixed_q["explanation"]) > 10:
                        fixed_q["correct_answer"] = fixed_q["explanation"]
                    else:
                        fixed_q["correct_answer"] = "Please provide a detailed response describing the main concept."
            
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
