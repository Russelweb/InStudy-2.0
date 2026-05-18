from config import settings
from services.document_processor import DocumentProcessor
from models.global_models import get_llm
import logging
import json
import re
from typing import List, Dict, Any, Optional
from database.auth_db import auth_db

logger = logging.getLogger(__name__)


class RAGService:
    """
    Enhanced RAG service with page-aware retrieval and conversation memory.
    Uses local Llama 3 and Sentence Transformers.
    """
    
    def __init__(self):
        # Embeddings are global
        self.embeddings = None # Loaded on demand via doc_processor
        self.doc_processor = DocumentProcessor()
        # Store conversation history per user/course
        self.conversation_memory: Dict[str, List[Dict[str, str]]] = {}
    
    def _get_personality_instruction(self, personality: str) -> str:
        """Get prompt modifier based on selected tutor personality"""
        p = (personality or "strict").lower()
        if p == "socratic":
            return (
                "PERSONALITY INSTRUCTION - SOCRATIC GUIDE:\n"
                "- You are a Socratic Guide. Do NOT just give direct answers or step-by-step solutions.\n"
                "- Instead, prompt the user's critical thinking by asking guiding questions and raising key concepts to help them discover the answer themselves.\n"
                "- IGNORE the standard structured explanation sections (like Definition, Step-by-step, Possible Exam Question, Summary). Instead, write a concise, conversational prompt with 1 or 2 high-quality Socratic questions based on the retrieved study materials."
            )
        elif p == "cheerleader":
            return (
                "PERSONALITY INSTRUCTION - CHEERLEADER STUDY BUDDY:\n"
                "- You are a highly enthusiastic Cheerleader. Be extremely warm, positive, energetic, and supportive.\n"
                "- Include study emojis (e.g. 🌟, 🚀, 💪, 📚) and highly encouraging phrases.\n"
                "- Inject positive reinforcement throughout your explanation (e.g. 'You're asking fantastic questions! Let's crush this!')."
            )
        elif p == "strict":
            return (
                "PERSONALITY INSTRUCTION - STRICT TUTOR:\n"
                "- You are a Strict, direct Tutor. Be highly formal, structured, concise, and no-nonsense.\n"
                "- Do NOT use emojis, exclamations, or conversational filler/fluff.\n"
                "- Keep explanations precise, mathematically rigorous, and straight-to-the-point."
            )
        return ""
    
    def _detect_and_update_language(self, user_id: str, question: str, llm):
        """Detect language of question and update user preference if it's consistent"""
        if not user_id.isdigit() or len(question) < 10:
            return
            
        try:
            # Quick check: if it's already the preferred language, skip
            current_lang = auth_db.get_preferred_language(int(user_id))
            
            # Ask LLM to detect language (very short prompt)
            detection_prompt = f"Identify the language of this text. Return ONLY the language name (e.g., 'English', 'Spanish', 'French'). Text: '{question[:100]}'"
            detected = llm.invoke(detection_prompt)
            detected_text = (detected if isinstance(detected, str) else getattr(detected, 'content', str(detected))).strip().lower()
            
            # Simple mapping to codes if needed, but we can store names too. 
            # Storing names is more flexible for the LLM prompts.
            if detected_text and detected_text not in current_lang.lower():
                logger.info(f"Detected new language for user {user_id}: {detected_text}")
                auth_db.update_preferred_language(int(user_id), detected_text.capitalize())
        except Exception as e:
            logger.error(f"Error detecting language: {e}")
    
    def _get_memory_key(self, user_id: str, course_id: str) -> str:
        """Generate unique key for conversation memory"""
        return f"{user_id}_{course_id}"
    
    def _add_to_memory(self, user_id: str, course_id: str, question: str, answer: str):
        """Add Q&A pair to conversation memory"""
        key = self._get_memory_key(user_id, course_id)
        
        if key not in self.conversation_memory:
            self.conversation_memory[key] = []
        
        self.conversation_memory[key].append({
            "question": question,
            "answer": answer
        })
        
        # Keep only last 5 exchanges to avoid context overflow
        self.conversation_memory[key] = self.conversation_memory[key][-5:]
    
    def _get_conversation_context(self, user_id: str, course_id: str) -> str:
        """Get formatted conversation history"""
        key = self._get_memory_key(user_id, course_id)
        
        if key not in self.conversation_memory or not self.conversation_memory[key]:
            return ""
        
        context = "\n\nPrevious Conversation:\n"
        for i, exchange in enumerate(self.conversation_memory[key], 1):
            context += f"\nQ{i}: {exchange['question']}\n"
            context += f"A{i}: {exchange['answer'][:200]}...\n"  # Truncate long answers
        
        return context
    
    def clear_memory(self, user_id: str, course_id: str):
        """Clear conversation memory for a user/course"""
        key = self._get_memory_key(user_id, course_id)
        if key in self.conversation_memory:
            del self.conversation_memory[key]
    
    def _extract_page_reference(self, question: str) -> Optional[int]:
        """Extract page number from question if mentioned"""
        # Patterns: "page 24", "pg 24", "p. 24", "page24"
        patterns = [
            r'page\s*(\d+)',
            r'pg\s*(\d+)',
            r'p\.\s*(\d+)',
            r'page(\d+)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, question.lower())
            if match:
                return int(match.group(1))
        
        return None
    
    def _extract_exercise_reference(self, question: str) -> Optional[str]:
        """Extract exercise/question number from question"""
        # Patterns: "exercise 1.12", "question 5", "problem 3.4"
        patterns = [
            r'exercise\s*([\d.]+)',
            r'question\s*([\d.]+)',
            r'problem\s*([\d.]+)',
            r'ex\s*([\d.]+)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, question.lower())
            if match:
                return match.group(1)
        
        return None
    
    def _retrieve_page_specific_content(self, vector_store, page_num: int, k: int = 5) -> List[Any]:
        """Retrieve content from a specific page with high precision and offset awareness"""
        logger.info(f"Attempting deep retrieval for page: {page_num}")
        
        # Step 1: Try exact metadata filter (most precise)
        # Check both the requested page and n-1 (for 0-indexed vs 1-indexed offsets)
        target_pages = [page_num, page_num - 1] if page_num > 1 else [page_num]
        
        try:
            for p in target_pages:
                page_docs = vector_store.similarity_search(
                    f"page {p}", # Use specific page search
                    k=min(20, k*2), 
                    filter={"page": p}
                )
                if page_docs:
                    logger.info(f"Found {len(page_docs)} chunks for target page {p}.")
                    return page_docs[:k]
        except Exception as e:
            logger.warning(f"Metadata filtering failed: {e}")

        # Step 2: Fallback - Manual filter on a large pool (Critical for large books)
        logger.info(f"Performing deep sweep (k=500) for page {page_num}...")
        all_docs = vector_store.similarity_search("", k=500) 
        
        # Filter for the page or its immediate neighbors (handling common PDF offsets)
        page_docs = [doc for doc in all_docs if doc.metadata.get('page') in [page_num, page_num-1, page_num+1]]
        
        if page_docs:
            # Prioritize the most exact matches
            page_docs.sort(key=lambda x: abs(x.metadata.get('page', 0) - page_num))
            logger.info(f"Found {len(page_docs)} documents in deep sweep.")
            return page_docs[:k]
            
        # Step 3: Last resort - Content-based marker search
        logger.info(f"Searching for content markers for page {page_num}...")
        return vector_store.similarity_search(f"page {page_num} pg {page_num} {page_num}", k=k)
    
    def _retrieve_exercise_content(self, vector_store, exercise_ref: str, question: str, k: int = 5) -> List[Any]:
        """Retrieve content related to specific exercise"""
        # Search for exercise reference in documents
        search_query = f"exercise {exercise_ref} question {exercise_ref} problem {exercise_ref}"
        docs = vector_store.similarity_search(search_query, k=k*2)
        
        # Filter docs that likely contain the exercise
        exercise_docs = []
        for doc in docs:
            content_lower = doc.page_content.lower()
            if exercise_ref in content_lower or f"exercise {exercise_ref}" in content_lower:
                exercise_docs.append(doc)
        
        return exercise_docs[:k] if exercise_docs else docs[:k]
    
    def _extract_section_reference(self, question: str) -> Optional[str]:
        """Extract section or chapter number from question"""
        # Patterns: "section 1.2", "sec 5", "chapter 3", "ch 4"
        patterns = [
            r'section\s*([\d.]+)',
            r'sec\s*([\d.]+)',
            r'chapter\s*(\d+)',
            r'ch\s*(\d+)',
            r'topic\s*([\d.]+)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, question.lower())
            if match:
                return match.group(1)
        
        return None
    
    def _retrieve_section_content(self, vector_store, section_ref: str, question: str, k: int = 5) -> List[Any]:
        """Retrieve content related to specific section/chapter with higher sensitivity"""
        # Search targets: "section 1.2", "1.2", etc.
        search_query = f"section {section_ref} chapter {section_ref} topic {section_ref} {section_ref} header {section_ref}"
        docs = vector_store.similarity_search(search_query, k=k*5) # Much larger k for sections
        
        # Filter docs that actually mention the section or have it in headers
        section_docs = []
        for doc in docs:
            txt = doc.page_content.lower()
            if section_ref in txt or f"section {section_ref}" in txt or f"chapter {section_ref}" in txt:
                section_docs.append(doc)
        
        return section_docs[:k] if section_docs else docs[:k]
    def answer_question_stream(self, user_id: str, course_id: str, question: str, use_eli12: bool = False, api_key: Optional[str] = None, personality: Optional[str] = None):
        """
        Stream answer word by word with page-aware retrieval and memory.
        Yields Server-Sent Events format.
        """
        logger.info(f"Streaming answer for user {user_id}, course {course_id}")
        
        personality_instruction = self._get_personality_instruction(personality)
        
        # Get appropriate LLM
        llm = get_llm(api_key)
        
        vector_store = self.doc_processor.get_vector_store(user_id, course_id)
        
        # Extract page, exercise, or section references
        page_ref = self._extract_page_reference(question)
        exercise_ref = self._extract_exercise_reference(question)
        section_ref = self._extract_section_reference(question)
        
        # Check if relevant documents exist
        has_context = False
        sources = []
        page_info = []
        prompt = ""
        
        # Cross-lingual retrieval support
        search_query = question
        
        if vector_store:
            logger.info("Retrieving relevant documents...")
            
            # Identify language and generate English search query if needed
            # (We do this only if the question is long enough and likely not English)
            try:
                # Get current preference
                current_lang = auth_db.get_preferred_language(int(user_id))
                
                # Detect current language for the prompt
                detection_prompt = f"Identify the language of this text. Respond ONLY with the single word for the language name. Text: '{question[:100]}'"
                detected = llm.invoke(detection_prompt)
                detected_lang_raw = (detected if isinstance(detected, str) else getattr(detected, 'content', str(detected))).strip()
                
                # Extract language name
                import re
                match = re.search(r'(English|Spanish|French|German|Italian|Portuguese|Chinese|Japanese|Russian|Arabic|Hindi)', detected_lang_raw, re.IGNORECASE)
                detected_lang = match.group(1).capitalize() if match else "English"
                
                logger.info(f"Language detection: '{detected_lang_raw}' -> '{detected_lang}'")
                
                # Optimize the question for semantic search
                if len(question) > 5:
                    optimization_prompt = f"Convert this user question into a concise, keyword-rich search query for a vector database. Return ONLY the optimized query text. Question: '{question}'"
                    search_query_raw = llm.invoke(optimization_prompt)
                    search_query = (search_query_raw if isinstance(search_query_raw, str) else getattr(search_query_raw, 'content', str(search_query_raw))).strip()
                    logger.info(f"Optimized search query: {search_query[:50]}...")
            except Exception as e:
                logger.warning(f"Failed to optimize search query: {e}")
                search_query = question
                detected_lang = "English"
            
            # Page-specific retrieval
            if page_ref:

                logger.info(f"Page-specific query detected: page {page_ref}")
                docs = self._retrieve_page_specific_content(vector_store, page_ref, k=5)
                if docs:
                    has_context = True
                    page_info.append(f"page {page_ref}")
            
            # Exercise-specific retrieval
            elif exercise_ref:
                logger.info(f"Exercise-specific query detected: {exercise_ref}")
                docs = self._retrieve_exercise_content(vector_store, exercise_ref, question, k=5)
                if docs:
                    has_context = True
            
            # Section-specific retrieval
            elif section_ref:
                logger.info(f"Section-specific query detected: {section_ref}")
                docs = self._retrieve_section_content(vector_store, section_ref, question, k=5)
                if docs:
                    has_context = True
            
            # General semantic search
            else:
                logger.info(f"Performing correlated retrieval for: {search_query}")
                primary_docs_with_scores = vector_store.similarity_search_with_score(search_query, k=settings.TOP_K_RETRIEVAL)
                foundational_docs = []
                try:
                    concept_extraction_prompt = f"Identify the 1-2 most important technical concepts in this query: '{search_query}'. Return ONLY the terms separated by a comma."
                    concepts_text = llm.invoke(concept_extraction_prompt)
                    concepts_text = concepts_text if isinstance(concepts_text, str) else getattr(concepts_text, 'content', str(concepts_text))
                    concepts = [c.strip() for c in concepts_text.split(",") if len(c.strip()) > 3]
                    for concept in concepts:
                        foundational_docs.extend(vector_store.similarity_search(f"Definition of {concept}", k=1))
                except Exception as e:
                    logger.warning(f"Foundational search failed: {e}")
                
                docs = []
                seen_contents = set()
                for doc, score in primary_docs_with_scores:
                    if score < settings.SIMILARITY_THRESHOLD:
                        if doc.page_content not in seen_contents:
                            docs.append(doc); seen_contents.add(doc.page_content); has_context = True
                for doc in foundational_docs[:2]:
                    if doc.page_content not in seen_contents:
                        docs.append(doc); seen_contents.add(doc.page_content)
                
                pages = set([doc.metadata.get('page') for doc in docs if doc.metadata.get('page')])
                if pages:
                    page_info = [f"page {p}" for p in sorted(pages)]
            
            if has_context and docs:
                # Build unified sources with page numbers: "filename#page=X"
                combined_sources = []
                for doc in docs:
                    name = doc.metadata.get("document_name", "Unknown")
                    page = doc.metadata.get("page")
                    if page:
                        combined_sources.append(f"{name}#page={page}")
                    else:
                        combined_sources.append(name)
                sources = list(set(combined_sources))
                
                # Build context with page information
                context_parts = []
                for doc in docs:
                    page_num = doc.metadata.get('page', 'Unknown')
                    doc_name = doc.metadata.get('document_name', 'Unknown')
                    context_parts.append(f"[{doc_name}, Page {page_num}]\n{doc.page_content}")
                
                context_text = "\n\n---\n\n".join(context_parts)
                
                # Get conversation history
                conversation_context = self._get_conversation_context(user_id, course_id)
                has_image_context = any(doc.metadata.get('is_image', False) for doc in docs)
                
                if has_image_context:
                    # Special "Free Talk" prompt for images
                    prompt = f"""You are a visual analysis expert. You are helping the user explore and understand an image they uploaded (e.g., a house plan, diagram, or chart).
{conversation_context}

{personality_instruction}

Visual Content Description:
{context_text}

Current Question: {question}

INSTRUCTIONS:
1. Speak in a natural, conversational, and helpful tone. 
2. Do NOT use a formal academic structure (no "Exam Questions" or "Step-by-Step Definitions" unless explicitly asked).
3. Focus on describing details, spatial relationships, or trends seen in the image.
4. If it's a house plan, help the user visualize the layout.
5. Keep the conversation flowing like a collaborative exploration.

LANGUAGE INSTRUCTION (MANDATORY):
You MUST respond entirely in {detected_lang}.
"""
                elif use_eli12:
                    prompt = f"""You are a friendly tutor explaining to a 12-year-old student.
{conversation_context}

{personality_instruction}

Study Material (with page numbers):
{context_text}

Current Question: {question}

Explain this concept using simple everyday language, fun analogies, short sentences, and no complex jargon.
IMPORTANT: For ANY mathematical expression, equation, or formula — always use LaTeX notation:
- Inline math: $expression$ (e.g. $x^2$, $\\sin(x)$, $\\frac{{a}}{{b}}$)
- Block/display math: $$expression$$ on its own line

Structure:
1. Simple Definition
2. Fun Example or Analogy
3. Why It Matters
4. Quick Summary

LANGUAGE INSTRUCTION (MANDATORY):
You MUST respond entirely in {detected_lang}. 
- Even if the history or material is in another language, your answer MUST be in {detected_lang}.
- If the material is not in {detected_lang}, act as an expert translator.

COURSE-WIDE INSTRUCTION:
- You have access to all documents in this course. 
- If the current topic builds on concepts from earlier documents (e.g. Chapter 2 concepts used in Chapter 6), explicitly mention the connection.
- Use the foundational background provided to give a more holistic explanation.
"""
                else:
                    prompt = f"""You are an expert AI tutor helping a university student.
{conversation_context}

{personality_instruction}

Study Material (with page numbers):
{context_text}

Current Question: {question}

IMPORTANT: For ANY mathematical expression, equation, symbol, or formula — always use LaTeX notation:
- Inline math: $expression$ (e.g. $f'(x)$, $\\cos(x^2)$, $\\frac{{d}}{{dx}}$)
- Block/display math: $$expression$$ on its own line for standalone equations

Provide a structured explanation:
1. Concept Definition (mention page numbers if relevant)
2. Step-by-Step Explanation
3. Example
4. Possible Exam Question
5. Quick Summary

If the question asks about a specific page or exercise, focus on that content.

LANGUAGE INSTRUCTION (MANDATORY):
You MUST respond entirely in {detected_lang}. 
- Even if the history or material is in another language, your answer MUST be in {detected_lang}.
- If the material is not in {detected_lang}, act as an expert translator.

COURSE-WIDE INSTRUCTION:
- You have access to all documents in this course. 
- If the current topic builds on concepts from earlier documents, explicitly mention the connection.
- Use the foundational background provided to give a more holistic explanation.
"""

        if not has_context:
            logger.warning(f"No relevant documents found for question: '{question[:50]}...'")
            logger.info(f"Vector store exists: {vector_store is not None}")
            if vector_store:
                # Try to get some basic info about the vector store
                try:
                    # Get any documents to see if the store has content
                    test_docs = vector_store.similarity_search("test", k=1)
                    logger.info(f"Vector store contains {len(test_docs)} documents (test search)")
                    if test_docs:
                        logger.info(f"Sample document metadata: {test_docs[0].metadata}")
                except Exception as e:
                    logger.error(f"Error testing vector store: {e}")
            
            # Get conversation history even without context
            conversation_context = self._get_conversation_context(user_id, course_id)
            
            if use_eli12:
                    prompt = f"""You are a friendly tutor explaining to a 12-year-old student.
{conversation_context}

{personality_instruction}

Current Question: {question}

Explain this concept using simple everyday language, fun analogies, short sentences, and no complex jargon.
IMPORTANT: For ANY mathematical expression, equation, or formula — always use LaTeX notation:
- Inline math: $expression$ (e.g. $x^2$, $\\sin(x)$, $\\frac{{a}}{{b}}$)
- Block/display math: $$expression$$ on its own line

LANGUAGE INSTRUCTION (CRITICAL):
Identify the language of the 'Current Question'. 
- Respond ENTIRELY in that same language.
- Even if the 'Previous Conversation' is in a different language, you MUST switch to the language of the 'Current Question' now.
"""
            else:
                    prompt = f"""You are a knowledgeable AI tutor.
{conversation_context}

{personality_instruction}

Current Question: {question}

IMPORTANT: For ANY mathematical expression, equation, symbol, or formula — always use LaTeX notation:
- Inline math: $expression$ (e.g. $f'(x)$, $\\cos(x^2)$, $\\frac{{d}}{{dx}}$)
- Block/display math: $$expression$$ on its own line for standalone equations

Provide a clear explanation as if teaching a university student. Include:
1. Clear definition
2. Step-by-Step explanation
3. Practical example
4. Quick summary

LANGUAGE INSTRUCTION (MANDATORY):
You MUST respond entirely in {detected_lang}. 
- Even if the history or material is in another language, your answer MUST be in {detected_lang}.
"""
        
        # Send metadata first
        yield f"data: {json.dumps({'type': 'metadata', 'sources': sources, 'has_context': has_context})}\n\n"
        
        # Stream the response
        logger.info("Streaming response from LLM...")
        full_response = ""
        try:
            for chunk in llm.stream(prompt):
                if chunk:
                    # Extract text content (handles both strings from Ollama and objects from Groq)
                    content = chunk if isinstance(chunk, str) else getattr(chunk, 'content', str(chunk))
                    if content:
                        full_response += content
                        yield f"data: {json.dumps({'type': 'content', 'text': content})}\n\n"

        except Exception as e:
            logger.error(f"Error during streaming: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        
        # Add to conversation memory
        if full_response:
            self._add_to_memory(user_id, course_id, question, full_response)
            
            # Detect language and update preference
            self._detect_and_update_language(user_id, question, llm)

        
        # Send completion signal with disclaimer
        disclaimer = "\n\n---\n*InStudy AI can make mistakes. Please verify important information with your original study materials.*"
        yield f"data: {json.dumps({'type': 'content', 'text': disclaimer})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"
    
    def get_memory_status(self, user_id: str, course_id: str) -> Dict[str, Any]:
        """Get conversation memory status"""
        key = self._get_memory_key(user_id, course_id)
        memory = self.conversation_memory.get(key, [])
        
        return {
            "has_memory": len(memory) > 0,
            "conversation_count": len(memory),
            "last_question": memory[-1]["question"] if memory else None
        }
    
    def answer_question(self, user_id: str, course_id: str, question: str, use_eli12: bool = False, api_key: Optional[str] = None, personality: Optional[str] = None):
        """
        Enhanced hybrid AI answering system with page-aware retrieval and memory.
        """
        logger.info(f"Answering question for user {user_id}, course {course_id}")
        
        personality_instruction = self._get_personality_instruction(personality)
        
        # Get appropriate LLM
        llm = get_llm(api_key)
        
        vector_store = self.doc_processor.get_vector_store(user_id, course_id)
        
        # Extract page or exercise references
        page_ref = self._extract_page_reference(question)
        exercise_ref = self._extract_exercise_reference(question)
        
        # Check if relevant documents exist
        has_context = False
        sources = []
        page_info = []
        
        # Cross-lingual retrieval support
        search_query = question
        
        # Identify language and generate search query if needed
        try:
            # Detect current language for the prompt
            detection_prompt = f"Identify the language of this text. Return ONLY the language name (e.g., 'English', 'Spanish', 'French'). Text: '{question[:100]}'"
            detected = llm.invoke(detection_prompt)
            detected_lang = (detected if isinstance(detected, str) else getattr(detected, 'content', str(detected))).strip().capitalize()
            if not detected_lang: detected_lang = "English"

            if len(question) > 5:
                optimization_prompt = f"Convert this user question into a concise, keyword-rich search query for a vector database. Maintain the original meaning. Return ONLY the optimized query text. Question: '{question}'"
                search_query = llm.invoke(optimization_prompt)
                search_query = search_query if isinstance(search_query, str) else getattr(search_query, 'content', str(search_query))
                search_query = search_query.strip()
        except Exception as e:
            logger.warning(f"Failed to optimize search query: {e}")
            search_query = question
            detected_lang = "English"

        if vector_store:
            logger.info("Retrieving relevant documents...")
            
            # Page-specific retrieval
            if page_ref:

                logger.info(f"Page-specific query detected: page {page_ref}")
                docs = self._retrieve_page_specific_content(vector_store, page_ref, k=5)
                if docs:
                    has_context = True
                    page_info.append(f"page {page_ref}")
            
            # Exercise-specific retrieval
            elif exercise_ref:
                logger.info(f"Exercise-specific query detected: {exercise_ref}")
                docs = self._retrieve_exercise_content(vector_store, exercise_ref, question, k=5)
                if docs:
                    has_context = True
            
            # General semantic search
            else:
                logger.info(f"Performing correlated retrieval for: {search_query}")
                primary_docs_with_scores = vector_store.similarity_search_with_score(search_query, k=settings.TOP_K_RETRIEVAL)
                foundational_docs = []
                try:
                    concept_extraction_prompt = f"Identify the 1-2 most important technical concepts in this query: '{search_query}'. Return ONLY the terms separated by a comma."
                    concepts_text = llm.invoke(concept_extraction_prompt)
                    concepts_text = concepts_text if isinstance(concepts_text, str) else getattr(concepts_text, 'content', str(concepts_text))
                    concepts = [c.strip() for c in concepts_text.split(",") if len(c.strip()) > 3]
                    for concept in concepts:
                        foundational_docs.extend(vector_store.similarity_search(f"Definition of {concept}", k=1))
                except Exception as e:
                    logger.warning(f"Foundational search failed: {e}")
                docs = []
                seen_contents = set()
                for doc, score in primary_docs_with_scores:
                    if score < settings.SIMILARITY_THRESHOLD:
                        if doc.page_content not in seen_contents:
                            docs.append(doc); seen_contents.add(doc.page_content); has_context = True
                for doc in foundational_docs[:2]:
                    if doc.page_content not in seen_contents:
                        docs.append(doc); seen_contents.add(doc.page_content)
                pages = set([doc.metadata.get('page') for doc in docs if doc.metadata.get('page')])
                if pages:
                    page_info = [f"page {p}" for p in sorted(pages)]
            
            if has_context and docs:
                # Build unified sources with page numbers: "filename#page=X"
                combined_sources = []
                for doc in docs:
                    name = doc.metadata.get("document_name", "Unknown")
                    page = doc.metadata.get("page")
                    if page:
                        combined_sources.append(f"{name}#page={page}")
                    else:
                        combined_sources.append(name)
                sources = list(set(combined_sources))
                
                # Build context with page information
                context_parts = []
                for doc in docs:
                    page_num = doc.metadata.get('page', 'Unknown')
                    doc_name = doc.metadata.get('document_name', 'Unknown')
                    context_parts.append(f"[{doc_name}, Page {page_num}]\n{doc.page_content}")
                
                context_text = "\n\n---\n\n".join(context_parts)
                
                # Get conversation history
                conversation_context = self._get_conversation_context(user_id, course_id)
                
                if use_eli12:
                    prompt = f"""You are a friendly tutor explaining to a 12-year-old student.
{conversation_context}

{personality_instruction}

Study Material (with page numbers):
{context_text}

Current Question: {question}

Explain this concept using simple everyday language, fun analogies, short sentences, and no complex jargon.
IMPORTANT: For ANY mathematical expression, equation, or formula — always use LaTeX notation:
- Inline math: $expression$ (e.g. $x^2$, $\\sin(x)$, $\\frac{{a}}{{b}}$)
- Block/display math: $$expression$$ on its own line

Structure:
1. Simple Definition
2. Fun Example or Analogy
3. Why It Matters
4. Quick Summary

LANGUAGE INSTRUCTION (MANDATORY):
You MUST respond entirely in {detected_lang}. 
- Even if the history or material is in another language, your answer MUST be in {detected_lang}.
- If the material is not in {detected_lang}, act as an expert translator.
"""
                else:
                    is_quick_chat = "[QUICK_CHAT]" in question
                    clean_question = question.replace("[QUICK_CHAT]", "").strip()

                    explanation_format = ""
                    if is_quick_chat:
                        explanation_format = f"Provide an extremely concise, direct answer in 2-3 sentences max. Do NOT use lists or structured sections. You MUST respond entirely in {detected_lang}."
                    else:
                        explanation_format = """Provide a structured explanation:
1. Concept Definition (mention page numbers if relevant)
2. Step-by-Step Explanation
3. Example
4. Possible Exam Question
5. Quick Summary"""

                    prompt = f"""You are an expert AI tutor helping a university student.
{conversation_context}

{personality_instruction}

Study Material (with page numbers):
{context_text}

Current Question: {clean_question}

IMPORTANT: For ANY mathematical expression, equation, symbol, or formula — always use LaTeX notation:
- Inline math: $expression$ (e.g. $f'(x)$, $\\cos(x^2)$, $\\frac{{d}}{{dx}}$)
- Block/display math: $$expression$$ on its own line for standalone equations

{explanation_format}

If the question asks about a specific page or exercise, focus on that content.

LANGUAGE INSTRUCTION (MANDATORY):
You MUST respond entirely in {detected_lang}. 
- Even if the history or material is in another language, your answer MUST be in {detected_lang}.
- If the material is not in {detected_lang}, act as an expert translator.

COURSE-WIDE INSTRUCTION:
- You have access to all documents in this course. 
- If the current topic builds on concepts from earlier documents (e.g. Chapter 2 concepts used in Chapter 6), explicitly mention the connection.
- Use the foundational background provided to give a more holistic explanation.
"""
                
                logger.info("Generating answer with context...")
                response = llm.invoke(prompt)
                # Extract text content
                response = response if isinstance(response, str) else getattr(response, 'content', str(response))
                
                # Add disclaimer
                disclaimer = "\n\n---\n*InStudy AI can make mistakes. Please verify important information with your original study materials.*"
                response += disclaimer
                
                # Add to conversation memory
                self._add_to_memory(user_id, course_id, question, response)
                
                # Sources already included page info in the new unified format
                source_info = sources
                return {
                    "answer": response,
                    "sources": source_info,
                    "has_context": True
                }
        
        # CASE 2: Answer without context (general knowledge)
        logger.info("No relevant documents found, using general knowledge...")
        
        # Get conversation history even without context
        conversation_context = self._get_conversation_context(user_id, course_id)
        
        if use_eli12:
            prompt = f"""You are a friendly tutor explaining to a 12-year-old student.
{conversation_context}

{personality_instruction}

Current Question: {question}

Explain this concept using simple everyday language, fun analogies, short sentences, and no complex jargon.
IMPORTANT: For ANY mathematical expression, equation, or formula — always use LaTeX notation:
- Inline math: $expression$ (e.g. $x^2$, $\\sin(x)$, $\\frac{{a}}{{b}}$)
- Block/display math: $$expression$$ on its own line

LANGUAGE INSTRUCTION:
Identify the language of the 'Current Question'. Respond ENTIRELY in that same language."""
        else:
            is_quick_chat = "[QUICK_CHAT]" in question
            clean_question = question.replace("[QUICK_CHAT]", "").strip()

            explanation_format = ""
            if is_quick_chat:
                explanation_format = f"Provide an extremely concise, direct answer in 2-3 sentences max. Do NOT use lists or structured sections. You MUST respond entirely in {detected_lang}."
            else:
                explanation_format = """Provide a clear explanation as if teaching a university student. Include:
1. Clear definition
2. Step-by-step explanation
3. Practical example
4. Quick summary"""

            prompt = f"""You are a knowledgeable AI tutor.
{conversation_context}

{personality_instruction}

Current Question: {clean_question}

IMPORTANT: For ANY mathematical expression, equation, symbol, or formula — always use LaTeX notation:
- Inline math: $expression$ (e.g. $f'(x)$, $\\cos(x^2)$, $\\frac{{d}}{{dx}}$)
- Block/display math: $$expression$$ on its own line for standalone equations

LANGUAGE INSTRUCTION:
Identify the language of the 'Current Question'. Respond ENTIRELY in that same language.

{explanation_format}"""
        
        response = llm.invoke(prompt)
        # Extract text content (handles both strings from Ollama and objects from Groq)
        response = response if isinstance(response, str) else getattr(response, 'content', str(response))
        
        # Add disclaimer
        disclaimer = "\n\n---\n*InStudy AI can make mistakes. Please verify important information with your original study materials.*"
        response += disclaimer
        
        # Add to conversation memory
        self._add_to_memory(user_id, course_id, question, response)
        
        # Detect language and update preference
        self._detect_and_update_language(user_id, question, llm)

        
        return {
            "answer": response,
            "sources": [],
            "has_context": False
        }
