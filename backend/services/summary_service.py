from config import settings
from services.document_processor import DocumentProcessor
from models.global_models import get_llm
from typing import Optional, Any
from database.auth_db import auth_db
import logging
import json

from services.concept_service import concept_service

logger = logging.getLogger(__name__)


class SummaryService:
    """
    Summary generation service using local LLM.
    Optimized for structured results and conceptual mapping.
    """
    
    def __init__(self):
        # Doc processor is global/stateless enough
        self.doc_processor = DocumentProcessor()
    
    def generate_summary(self, user_id: str, course_id: str, document_name: str = None, style: str = "short", topic: Optional[str] = None, api_key: Optional[str] = None):
        """Generate high-quality summary with mastery adaptation."""
        logger.info(f"Generating summary with mastery adaptation for user {user_id}{f' focused on topic: {topic}' if topic else ''}")
        
        # Get appropriate LLM
        llm = get_llm(api_key)
        
        vector_store = self.doc_processor.get_vector_store(user_id, course_id)
        if not vector_store:
            raise ValueError("No documents found for this course. Please upload study materials first.")
            
        # Get documents (optimized retrieval) - use topic for search if specified
        search_query = topic if topic else ""
        docs = vector_store.similarity_search(search_query, k=20, filter={"document_name": document_name} if document_name else None)
        content = "\n\n".join([doc.page_content for doc in docs[:12]])
        
        # Get mastery context
        mastery_context = concept_service.get_summary_context_for_mastery(user_id, course_id)
        # Style mapping
        style_prompts = {
            "short": "concise bulleted summary focusing on core definitions",
            "detailed": "comprehensive structured summary with in-depth explanations and examples",
            "exam": "highly focused summary targeting likely exam topics and key terminology"
        }
         
        # Get preferred language  
        preferred_language = "English"
        if user_id.isdigit():
            preferred_language = auth_db.get_preferred_language(int(user_id))
        
        # Add topic focus to prompt if specified
        topic_instruction = f"\n\nTOPIC FOCUS: Focus your summary EXCLUSIVELY on '{topic}'. All content must be directly related to this specific topic." if topic else ""
        
        prompt = f"""{mastery_context}Analyze the study material provided:
{content}{topic_instruction}

Task:
1. Create a {style_prompts.get(style, style_prompts['short'])}. Use rich markdown (bold, bullets).
2. At the end, provide a conceptual mind map in Graphviz DOT format (digraph {{ ... }}).

LANGUAGE INSTRUCTION:
The user's preferred language is: {preferred_language}.
1. Generate the summary and all explanations ENTIRELY in {preferred_language}.
2. Ensure the mind map labels are also in {preferred_language}.
3. If the source material is in a different language, act as a professional translator.

CRITICAL DOT SYNTAX:
- Use -> for edges.
- Define node labels as Node1 [label="Label Text"];
- Example: 
digraph {{
    rankdir=LR;
    Start [label="Start Topic"];
    Middle [label="Subtopic"];
    Start -> Middle;
}}

[[CONCEPT_MAP]]
[Your Beautiful Summary here]

[[CONCEPT_MAP_DOT]]
[Your Graphviz DOT code here]
"""
        
        logger.info("Generating high-quality textual and visual summary...")
        response = llm.invoke(prompt)
        response_text = response if isinstance(response, str) else getattr(response, 'content', str(response))
        
        try:
            summary = response_text
            mind_map = None
            
            # Look for explicit delimiters (new or old)
            if "[[CONCEPT_MAP_DOT]]" in response_text:
                parts = response_text.split("[[CONCEPT_MAP_DOT]]")
                summary, mind_map = parts[0], parts[1]
            elif "[[CONCEPT_MAP]]" in response_text:
                parts = response_text.split("[[CONCEPT_MAP]]")
                summary, mind_map = parts[0], parts[1]
            elif "digraph" in response_text:
                # Use the last occurrence to avoid the prompt example if echoed
                start_idx = response_text.rfind("digraph")
                summary = response_text[:start_idx]
                mind_map = response_text[start_idx:]
            
            if mind_map:
                # Clean up any potential markdown code blocks
                if "```doc" in mind_map: mind_map = mind_map.split("```dot")[1].split("```")[0]
                elif "```" in mind_map: mind_map = mind_map.split("```")[1].split("```")[0]
                
                # Strip AI placeholder echoes and instructions
                for noise in ["[Your Graphviz DOT code here]", "[[CONCEPT_MAP_DOT]]", "[[CONCEPT_MAP]]"]:
                    mind_map = mind_map.replace(noise, "")
                
                # Final graph constraint
                if "}" in mind_map:
                    mind_map = mind_map[:mind_map.rfind("}")+1]
                mind_map = mind_map.strip()

            # Final summary cleanup (strip prompt noise and headers)
            for noise in ["Summary:", "[[CONCEPT_MAP]]", "[[CONCEPT_MAP_DOT]]", "[Your Beautiful Summary here]"]:
                summary = summary.replace(noise, "")
            
            summary = summary.strip()
            # Add disclaimer
            summary += "\n\n---\n*InStudy AI can make mistakes. Please verify important information with your original study materials.*"
            return {"summary": summary, "mind_map": mind_map}
        except Exception as e:
            logger.error(f"Failed to parse conceptual summary: {e}")
            return {"summary": response_text, "mind_map": None}
