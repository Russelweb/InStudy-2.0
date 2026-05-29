"""
InSpace backend service for structural breakdown generation and details extraction.
Interfaces with local/cloud LLMs to produce concepts, connections, explanations, and quizzes.
"""

from models.global_models import get_llm
from services.document_processor import DocumentProcessor
from database.inspace_db import inspace_db
from config import settings
import logging
import json
import uuid
import re
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

class InSpaceService:
    def __init__(self):
        self.doc_processor = DocumentProcessor()

    def generate_breakdown(self, topic: str, user_id: str, document_id: Optional[str] = None, api_key: Optional[str] = None) -> Dict[str, Any]:
        """
        Generate structural subtopic node maps and dependencies for InSpace canvas.
        Supports:
          1. Standalone (document_id is None): Queries general LLM knowledge.
          2. Document-grounded (document_id specified): Retrieves relevant source texts to ground subtopics.
        """
        llm = get_llm(api_key)
        context_text = ""
        is_grounded = False

        # If document is provided, fetch top context snippets to guide the subtopic extraction
        if document_id:
            try:
                # InStudy 2.0 uses course_id in the vector store. Here, document_id is passed as course_id in DB methods.
                vector_store = self.doc_processor.get_vector_store(user_id, document_id)
                if vector_store:
                    docs = vector_store.similarity_search(topic, k=6)
                    if docs:
                        context_text = "\n\n".join([doc.page_content[:1500] for doc in docs])
                        is_grounded = True
                        logger.info(f"InSpace breakdown grounded in document content (length: {len(context_text)})")
            except Exception as e:
                logger.error(f"Failed to fetch document context for InSpace generation: {e}")

        # Construct prompt
        if is_grounded:
            prompt = f"""
            You are a curriculum developer.
            Based on the study materials below, break down the topic: '{topic}' into a dynamic visual learning canvas.
            
            Study Materials Context:
            {context_text}
            
            Create 5 to 8 distinct subtopic nodes. Identify prerequisite connections (prerequisites) between them.
            Arrange them in wider coordinates (x: 0 to 1500, y: 100 to 500) representing a logical flow from left to right.
            CRITICAL: Number each node's label prefix clearly to show the exact studying order (e.g. "1. Introduction", "2. Core Concepts").

            Return ONLY a valid JSON object matching this exact format:
            {{
                "nodes": [
                    {{"id": "node_1", "label": "1. Introduction to Photosynthesis", "difficulty": "Beginner", "x": 100, "y": 200}},
                    {{"id": "node_2", "label": "2. Chloroplasts & Pigments", "difficulty": "Beginner", "x": 350, "y": 200}}
                ],
                "edges": [
                    {{"id": "edge_1", "source": "node_1", "target": "node_2"}}
                ]
            }}
            Do not include Markdown wrappers (such as ```json) or any conversational text. Respond ONLY with pure JSON.
            """
        else:
            prompt = f"""
            You are an expert educator.
            Break down the topic: '{topic}' into a dynamic visual learning canvas.
            
            Create 5 to 8 distinct subtopic nodes. Identify logical prerequisite connections (prerequisites) between them.
            Arrange them in wider coordinates (x: 0 to 1500, y: 100 to 500) representing a logical learning flow from left to right.
            CRITICAL: Number each node's label prefix clearly to show the exact studying order (e.g. "1. Introduction", "2. Core Mechanics").

            Return ONLY a valid JSON object matching this exact format:
            {{
                "nodes": [
                    {{"id": "node_1", "label": "1. Concept Introduction", "difficulty": "Beginner", "x": 100, "y": 200}},
                    {{"id": "node_2", "label": "2. Core Mechanics", "difficulty": "Intermediate", "x": 400, "y": 200}}
                ],
                "edges": [
                    {{"id": "edge_1", "source": "node_1", "target": "node_2"}}
                ]
            }}
            Do not include Markdown wrappers (such as ```json) or any conversational text. Respond ONLY with pure JSON.
            """

        canvas_id = f"canvas_{uuid.uuid4().hex[:12]}"
        
        try:
            response = llm.invoke(prompt)
            response_text = response if isinstance(response, str) else getattr(response, 'content', str(response))
            
            # Clean up response (strip markdown brackets if the LLM ignores instructions)
            response_text = re.sub(r"^```json\s*", "", response_text, flags=re.MULTILINE)
            response_text = re.sub(r"\s*```$", "", response_text, flags=re.MULTILINE)
            response_text = response_text.strip()
            
            parsed = json.loads(response_text)
            
            nodes = parsed.get("nodes", [])
            edges = parsed.get("edges", [])
            
            # Save structure metadata to DB
            inspace_db.create_canvas(canvas_id, user_id, topic, document_id)
            inspace_db.save_canvas_structure(canvas_id, nodes, edges)
            
            return {
                "canvas_id": canvas_id,
                "topic": topic,
                "document_id": document_id,
                "nodes": nodes,
                "edges": edges
            }
            
        except Exception as e:
            logger.error(f"Error generating InSpace breakdown: {e}")
            # Dynamic fallback generation
            fallback_nodes = [
                {"id": "node_1", "label": f"Intro to {topic}", "difficulty": "Beginner", "x": 100, "y": 200},
                {"id": "node_2", "label": "Core Concepts", "difficulty": "Intermediate", "x": 350, "y": 200},
                {"id": "node_3", "label": "Advanced Practice & Applications", "difficulty": "Advanced", "x": 600, "y": 200}
            ]
            fallback_edges = [
                {"id": "edge_1", "source": "node_1", "target": "node_2"},
                {"id": "edge_2", "source": "node_2", "target": "node_3"}
            ]
            inspace_db.create_canvas(canvas_id, user_id, topic, document_id)
            inspace_db.save_canvas_structure(canvas_id, fallback_nodes, fallback_edges)
            
            return {
                "canvas_id": canvas_id,
                "topic": topic,
                "document_id": document_id,
                "nodes": fallback_nodes,
                "edges": fallback_edges,
                "fallback": True
            }

    def generate_node_details(self, canvas_id: str, node_id: str, label: str, topic: str, document_id: Optional[str] = None, user_id: str = "default", api_key: Optional[str] = None) -> Dict[str, Any]:
        """
        Generate detailed explanation materials, key points, real-world examples, 
        common pitfalls/mistakes, and a dynamic interactive mini-quiz for a concept node.
        """
        llm = get_llm(api_key)
        context_text = ""
        
        if document_id:
            try:
                vector_store = self.doc_processor.get_vector_store(user_id, document_id)
                if vector_store:
                    docs = vector_store.similarity_search(f"{label} in the context of {topic}", k=3)
                    context_text = "\n\n".join([doc.page_content[:1500] for doc in docs])
            except Exception as e:
                logger.error(f"Failed to fetch grounded context for node {label}: {e}")

        source_prefix = f"Source Material Context:\n{context_text}" if context_text else "No source material: use general knowledge."

        prompt = f"""
        You are a supportive and clear learning assistant.
        Provide structured educational contents for the concept node: '{label}' (under the general topic '{topic}').
        
        {source_prefix}
        
        Generate the explanation, key takeaways, real-world examples, misconceptions, and 3 multiple choice mini-quiz questions.
        
        IMPORTANT: Return ONLY a valid JSON object matching this exact schema format:
        {{
            "explanation": "Beginner-friendly clear breakdown of the concept...",
            "key_points": [
                "Summarized key takeaway point 1",
                "Summarized key takeaway point 2"
            ],
            "examples": [
                "Real world analogy or applied example 1"
            ],
            "common_mistakes": [
                "A common misconception or error to avoid..."
            ],
            "quiz": [
                {{
                    "question": "Quiz question content?",
                    "options": ["Option A", "Option B", "Option C", "Option D"],
                    "answer": 0,
                    "explanation": "Detailed explanation of why Option A is correct..."
                }}
            ]
        }}
        Do not include Markdown wrappers or conversational text. Respond ONLY with pure JSON.
        """

        try:
            response = llm.invoke(prompt)
            response_text = response if isinstance(response, str) else getattr(response, 'content', str(response))
            
            response_text = re.sub(r"^```json\s*", "", response_text, flags=re.MULTILINE)
            response_text = re.sub(r"\s*```$", "", response_text, flags=re.MULTILINE)
            response_text = response_text.strip()
            
            data = json.loads(response_text)
            
            # Retrieve node notes & bookmarks from existing DB records if any, then save details
            canvas = inspace_db.get_canvas(canvas_id)
            existing_node = next((n for n in canvas["nodes"] if n["id"] == node_id), {}) if canvas else {}
            
            merged_node = {
                "id": node_id,
                "label": label,
                "x": existing_node.get("x", 0.0),
                "y": existing_node.get("y", 0.0),
                "difficulty": existing_node.get("difficulty", "Beginner"),
                "mastery": existing_node.get("mastery", 0.0),
                "confidence": existing_node.get("confidence", 0.0),
                "attempts": existing_node.get("attempts", 0),
                "time_spent": existing_node.get("time_spent", 0),
                "explanation": data.get("explanation", ""),
                "key_points": data.get("key_points", []),
                "examples": data.get("examples", []),
                "common_mistakes": data.get("common_mistakes", []),
                "quiz": data.get("quiz", []),
                "notes": existing_node.get("notes", ""),
                "is_bookmarked": existing_node.get("is_bookmarked", 0)
            }
            
            # Save to database
            inspace_db.save_canvas_structure(canvas_id, [merged_node], canvas.get("edges", []) if canvas else [])
            return merged_node
            
        except Exception as e:
            logger.error(f"Error generating node details: {e}")
            # Basic fallback schema
            fallback_details = {
                "id": node_id,
                "label": label,
                "explanation": f"This node covers {label}. Try asking AI in the chat for direct instruction on this topic.",
                "key_points": [f"Introduction to {label}"],
                "examples": ["General application"],
                "common_mistakes": ["Confusing definitions"],
                "quiz": [
                    {
                        "question": f"What is the main focus of {label}?",
                        "options": ["Basic concepts", "Irrelevant details", "None of the above"],
                        "answer": 0,
                        "explanation": f"Focuses on learning {label}."
                    }
                ]
            }
            return fallback_details

    def answer_contextual_question(self, canvas_id: str, node_id: str, label: str, question: str, user_id: str, api_key: Optional[str] = None) -> str:
        """
        Tutor chat answer grounded in current InSpace node details, topic, and optional RAG docs.
        """
        llm = get_llm(api_key)
        
        # Pull canvas info & node info
        canvas = inspace_db.get_canvas(canvas_id)
        node_details = ""
        topic = "General Study"
        document_id = None
        
        if canvas:
            topic = canvas.get("topic", "General Study")
            document_id = canvas.get("document_id")
            node = next((n for n in canvas["nodes"] if n["id"] == node_id), None)
            if node:
                node_details = f"Node Title: {node['label']}\nDescription: {node['explanation']}"
        
        # If document context exists, fetch it too
        doc_context = ""
        if document_id:
            try:
                vector_store = self.doc_processor.get_vector_store(user_id, document_id)
                if vector_store:
                    docs = vector_store.similarity_search(f"{label} {question}", k=2)
                    doc_context = "\n".join([d.page_content[:1000] for d in docs])
            except Exception as e:
                logger.error(f"RAG fetch failure for contextual tutor: {e}")
                
        grounding_prefix = f"Document Grounding Context:\n{doc_context}" if doc_context else ""

        prompt = f"""
        You are an interactive learning assistant tutoring a student inside their interactive InSpace visual graph.
        
        Current Topic: {topic}
        Current Node: {label}
        
        Concept Context:
        {node_details}
        
        {grounding_prefix}
        
        Student's Question: "{question}"
        
        INSTRUCTIONS:
        1. Keep explanations clear, engaging, and beginner-friendly.
        2. Give concrete examples to illustrate definitions.
        3. Do NOT output markdown sections like 'Possible Exam Questions' unless explicitly asked.
        """
        
        try:
            response = llm.invoke(prompt)
            response_text = response if isinstance(response, str) else getattr(response, 'content', str(response))
            return response_text.strip()
        except Exception as e:
            logger.error(f"Error answering contextual question: {e}")
            return "Sorry, I encountered an issue retrieving that. Try asking again!"

# Global Instance
inspace_service = InSpaceService()
