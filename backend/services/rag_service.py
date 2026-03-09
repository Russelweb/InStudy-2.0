from config import settings
from services.document_processor import DocumentProcessor
from models.global_models import get_llm
import logging
import json

logger = logging.getLogger(__name__)


class RAGService:
    """
    RAG service using local Llama 3 and Sentence Transformers.
    Optimized for speed with proper retrieval pipeline.
    """
    
    def __init__(self):
        # Use global LLM instance (loaded once)
        self.llm = get_llm()
        self.doc_processor = DocumentProcessor()
    
    def answer_question_stream(self, user_id: str, course_id: str, question: str, use_eli12: bool = False):
        """
        Stream answer word by word for better UX.
        Yields Server-Sent Events format.
        """
        logger.info(f"Streaming answer for user {user_id}, course {course_id}")
        
        vector_store = self.doc_processor.get_vector_store(user_id, course_id)
        
        # Check if relevant documents exist
        has_context = False
        sources = []
        prompt = ""
        
        if vector_store:
            logger.info("Retrieving relevant documents...")
            docs = vector_store.similarity_search_with_score(question, k=settings.TOP_K_RETRIEVAL)
            
            if docs and docs[0][1] < settings.SIMILARITY_THRESHOLD:
                has_context = True
                sources = list(set([doc[0].metadata.get("document_name", "Unknown") for doc in docs]))
                context_text = "\n\n".join([doc[0].page_content for doc in docs])
                
                if use_eli12:
                    prompt = f"""You are a friendly tutor explaining to a 12-year-old student.
                    
Study Material:
{context_text}

Question: {question}

Explain this concept using:
- Simple everyday language
- Fun analogies and examples
- Short sentences
- No complex jargon

Structure:
1. Simple Definition
2. Fun Example or Analogy
3. Why It Matters
4. Quick Summary"""
                else:
                    prompt = f"""You are an expert AI tutor helping a university student.

Study Material:
{context_text}

Question: {question}

Provide a structured explanation:
1. Concept Definition
2. Step-by-Step Explanation
3. Example
4. Possible Exam Question
5. Quick Summary"""
        
        if not has_context:
            logger.info("No relevant documents found, using general knowledge...")
            
            if use_eli12:
                prompt = f"""You are a friendly tutor explaining to a 12-year-old student.

Question: {question}

Explain this concept using:
- Simple everyday language
- Fun analogies and examples
- Short sentences
- No complex jargon"""
            else:
                prompt = f"""You are a knowledgeable AI tutor.

Question: {question}

Provide a clear explanation as if teaching a university student. Include:
1. Clear definition
2. Step-by-step explanation
3. Practical example
4. Quick summary"""
        
        # Send metadata first
        yield f"data: {json.dumps({'type': 'metadata', 'sources': sources, 'has_context': has_context})}\n\n"
        
        # Stream the response
        logger.info("Streaming response from LLM...")
        try:
            for chunk in self.llm.stream(prompt):
                if chunk:
                    yield f"data: {json.dumps({'type': 'content', 'text': chunk})}\n\n"
        except Exception as e:
            logger.error(f"Error during streaming: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        
        # Send completion signal
        yield f"data: {json.dumps({'type': 'done'})}\n\n"
    
    def answer_question(self, user_id: str, course_id: str, question: str, use_eli12: bool = False):
        """
        Hybrid AI answering system with local models.
        Uses optimized RAG pipeline for fast responses.
        """
        logger.info(f"Answering question for user {user_id}, course {course_id}")
        
        vector_store = self.doc_processor.get_vector_store(user_id, course_id)
        
        # Check if relevant documents exist
        has_context = False
        sources = []
        
        if vector_store:
            # Search for relevant chunks (optimized: top_k=3 for speed)
            logger.info("Retrieving relevant documents...")
            docs = vector_store.similarity_search_with_score(question, k=settings.TOP_K_RETRIEVAL)
            
            # Check similarity threshold
            if docs and docs[0][1] < settings.SIMILARITY_THRESHOLD:
                has_context = True
                sources = [doc[0].metadata.get("document_name", "Unknown") for doc in docs]
                
                # CASE 1: Answer with context
                context_text = "\n\n".join([doc[0].page_content for doc in docs])
                
                if use_eli12:
                    prompt = f"""You are a friendly tutor explaining to a 12-year-old student.
                    
Study Material:
{context_text}

Question: {question}

Explain this concept using:
- Simple everyday language
- Fun analogies and examples
- Short sentences
- No complex jargon

Structure:
1. Simple Definition
2. Fun Example or Analogy
3. Why It Matters
4. Quick Summary"""
                else:
                    prompt = f"""You are an expert AI tutor helping a university student.

Study Material:
{context_text}

Question: {question}

Provide a structured explanation:
1. Concept Definition
2. Step-by-Step Explanation
3. Example
4. Possible Exam Question
5. Quick Summary"""
                
                logger.info("Generating answer with context...")
                response = self.llm.invoke(prompt)
                
                return {
                    "answer": response,
                    "sources": list(set(sources)),
                    "has_context": True
                }
        
        # CASE 2: Answer without context (general knowledge)
        logger.info("No relevant documents found, using general knowledge...")
        
        if use_eli12:
            prompt = f"""You are a friendly tutor explaining to a 12-year-old student.

Question: {question}

Explain this concept using:
- Simple everyday language
- Fun analogies and examples
- Short sentences
- No complex jargon"""
        else:
            prompt = f"""You are a knowledgeable AI tutor.

Question: {question}

Provide a clear explanation as if teaching a university student. Include:
1. Clear definition
2. Step-by-step explanation
3. Practical example
4. Quick summary"""
        
        response = self.llm.invoke(prompt)
        
        return {
            "answer": response,
            "sources": [],
            "has_context": False
        }
