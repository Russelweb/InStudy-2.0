from config import settings
from services.document_processor import DocumentProcessor
from models.global_models import get_llm
import logging
import json
import re
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


class RAGService:
    """
    Enhanced RAG service with page-aware retrieval and conversation memory.
    Uses local Llama 3 and Sentence Transformers.
    """
    
    def __init__(self):
        # Use global LLM instance (loaded once)
        self.llm = get_llm()
        self.doc_processor = DocumentProcessor()
        # Store conversation history per user/course
        self.conversation_memory: Dict[str, List[Dict[str, str]]] = {}
    
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
        """Retrieve content from a specific page"""
        # Get more documents initially
        all_docs = vector_store.similarity_search("", k=50)
        
        # Filter for specific page
        page_docs = [doc for doc in all_docs if doc.metadata.get('page') == page_num]
        
        # Return top k from that page
        return page_docs[:k] if page_docs else []
    
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
    
    def answer_question_stream(self, user_id: str, course_id: str, question: str, use_eli12: bool = False):
        """
        Stream answer word by word with page-aware retrieval and memory.
        Yields Server-Sent Events format.
        """
        logger.info(f"Streaming answer for user {user_id}, course {course_id}")
        
        vector_store = self.doc_processor.get_vector_store(user_id, course_id)
        
        # Extract page or exercise references
        page_ref = self._extract_page_reference(question)
        exercise_ref = self._extract_exercise_reference(question)
        
        # Check if relevant documents exist
        has_context = False
        sources = []
        page_info = []
        prompt = ""
        
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
                docs_with_scores = vector_store.similarity_search_with_score(question, k=settings.TOP_K_RETRIEVAL)
                
                if docs_with_scores and docs_with_scores[0][1] < settings.SIMILARITY_THRESHOLD:
                    has_context = True
                    docs = [doc[0] for doc in docs_with_scores]
                    # Extract page information
                    pages = set([doc.metadata.get('page') for doc in docs if doc.metadata.get('page')])
                    if pages:
                        page_info = [f"page {p}" for p in sorted(pages)]
                else:
                    docs = []
            
            if has_context and docs:
                sources = list(set([doc.metadata.get("document_name", "Unknown") for doc in docs]))
                
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

Study Material (with page numbers):
{context_text}

Current Question: {question}

Explain this concept using:
- Simple everyday language
- Fun analogies and examples
- Short sentences
- No complex jargon
- Reference the page numbers when relevant

Structure:
1. Simple Definition
2. Fun Example or Analogy
3. Why It Matters
4. Quick Summary"""
                else:
                    prompt = f"""You are an expert AI tutor helping a university student.
{conversation_context}

Study Material (with page numbers):
{context_text}

Current Question: {question}

Provide a structured explanation:
1. Concept Definition (mention page numbers if relevant)
2. Step-by-Step Explanation
3. Example
4. Possible Exam Question
5. Quick Summary

If the question asks about a specific page or exercise, focus on that content."""
                
                # Add page info to sources
                if page_info:
                    sources.extend(page_info)
        
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

Current Question: {question}

Explain this concept using:
- Simple everyday language
- Fun analogies and examples
- Short sentences
- No complex jargon"""
            else:
                prompt = f"""You are a knowledgeable AI tutor.
{conversation_context}

Current Question: {question}

Provide a clear explanation as if teaching a university student. Include:
1. Clear definition
2. Step-by-step explanation
3. Practical example
4. Quick summary"""
        
        # Send metadata first
        yield f"data: {json.dumps({'type': 'metadata', 'sources': sources, 'has_context': has_context})}\n\n"
        
        # Stream the response
        logger.info("Streaming response from LLM...")
        full_response = ""
        try:
            for chunk in self.llm.stream(prompt):
                if chunk:
                    full_response += chunk
                    yield f"data: {json.dumps({'type': 'content', 'text': chunk})}\n\n"
        except Exception as e:
            logger.error(f"Error during streaming: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        
        # Add to conversation memory
        if full_response:
            self._add_to_memory(user_id, course_id, question, full_response)
        
        # Send completion signal
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
    
    def answer_question(self, user_id: str, course_id: str, question: str, use_eli12: bool = False):
        """
        Enhanced hybrid AI answering system with page-aware retrieval and memory.
        """
        logger.info(f"Answering question for user {user_id}, course {course_id}")
        
        vector_store = self.doc_processor.get_vector_store(user_id, course_id)
        
        # Extract page or exercise references
        page_ref = self._extract_page_reference(question)
        exercise_ref = self._extract_exercise_reference(question)
        
        # Check if relevant documents exist
        has_context = False
        sources = []
        page_info = []
        
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
                docs_with_scores = vector_store.similarity_search_with_score(question, k=settings.TOP_K_RETRIEVAL)
                
                if docs_with_scores and docs_with_scores[0][1] < settings.SIMILARITY_THRESHOLD:
                    has_context = True
                    docs = [doc[0] for doc in docs_with_scores]
                    # Extract page information
                    pages = set([doc.metadata.get('page') for doc in docs if doc.metadata.get('page')])
                    if pages:
                        page_info = [f"page {p}" for p in sorted(pages)]
                else:
                    docs = []
            
            if has_context and docs:
                sources = list(set([doc.metadata.get("document_name", "Unknown") for doc in docs]))
                
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

Study Material (with page numbers):
{context_text}

Current Question: {question}

Explain this concept using:
- Simple everyday language
- Fun analogies and examples
- Short sentences
- No complex jargon
- Reference the page numbers when relevant

Structure:
1. Simple Definition
2. Fun Example or Analogy
3. Why It Matters
4. Quick Summary"""
                else:
                    prompt = f"""You are an expert AI tutor helping a university student.
{conversation_context}

Study Material (with page numbers):
{context_text}

Current Question: {question}

Provide a structured explanation:
1. Concept Definition (mention page numbers if relevant)
2. Step-by-Step Explanation
3. Example
4. Possible Exam Question
5. Quick Summary

If the question asks about a specific page or exercise, focus on that content."""
                
                logger.info("Generating answer with context...")
                response = self.llm.invoke(prompt)
                
                # Add to conversation memory
                self._add_to_memory(user_id, course_id, question, response)
                
                # Build source info with pages
                source_info = sources.copy()
                if page_info:
                    source_info.extend(page_info)
                
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

Current Question: {question}

Explain this concept using:
- Simple everyday language
- Fun analogies and examples
- Short sentences
- No complex jargon"""
        else:
            prompt = f"""You are a knowledgeable AI tutor.
{conversation_context}

Current Question: {question}

Provide a clear explanation as if teaching a university student. Include:
1. Clear definition
2. Step-by-step explanation
3. Practical example
4. Quick summary"""
        
        response = self.llm.invoke(prompt)
        
        # Add to conversation memory
        self._add_to_memory(user_id, course_id, question, response)
        
        return {
            "answer": response,
            "sources": [],
            "has_context": False
        }
