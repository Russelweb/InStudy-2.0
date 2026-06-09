"""
Concept Extraction Service — Phase 1, Tasks 1.2 + 1.3

Automatically extracts a 3-level concept hierarchy from document text:
  Tier 2: Concept  (e.g. "Reaction Mechanisms")
  Tier 3: Subtopic (e.g. "SN1 Reactions")

Called as an async background task when a document is uploaded.
Does NOT block the upload response.

Flow:
  1. document_processor processes the file → chunks stored in FAISS
  2. Background task calls extract_and_store_concepts(...)
  3. LLM returns structured JSON concept hierarchy
  4. Concepts inserted into course_concepts via mastery_v2_db
  5. document_weight computed and stored in course_documents
"""

import json
import logging
import re
from typing import List, Dict, Optional

from database.mastery_v2_db import mastery_v2_db, WEIGHT_VALUES

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Extraction prompt
# ---------------------------------------------------------------------------

EXTRACTION_SYSTEM_PROMPT = """You are an academic concept extractor. Your job is to analyse study material and extract a structured concept map.

OUTPUT FORMAT — return ONLY valid JSON, no markdown fences, no explanation:
{
  "concepts": [
    {
      "name": "Concept Name",
      "weight": "core|supporting|peripheral",
      "subtopics": [
        {"name": "Subtopic Name", "weight": "core|supporting|peripheral"},
        ...
      ]
    },
    ...
  ]
}

RULES:
- Extract 5–15 top-level concepts from the material
- Each concept must have 2–8 subtopics
- weight "core" = fundamental to the subject, must be understood first
- weight "supporting" = important but builds on core concepts
- weight "peripheral" = useful context, not essential for basic mastery
- Concept and subtopic names must be specific and academic (not generic like "Introduction" or "Overview")
- Do not include page numbers, author names, or administrative information
- Subtopic names must be distinct within their parent concept
- Return ONLY the JSON object, nothing else"""


def _build_extraction_prompt(text_sample: str) -> str:
    return (
        f"Extract the concept hierarchy from this study material:\n\n"
        f"---\n{text_sample[:6000]}\n---\n\n"
        f"Return ONLY the JSON object as specified."
    )


# ---------------------------------------------------------------------------
# JSON parsing (robust — handles LLM quirks)
# ---------------------------------------------------------------------------

def _parse_llm_json(raw: str) -> Optional[Dict]:
    """
    Robustly parse LLM output that should be JSON.
    Handles: markdown fences, leading text, trailing text.
    """
    # Strip markdown code fences
    cleaned = re.sub(r"```(?:json)?", "", raw).strip()
    cleaned = re.sub(r"```", "", cleaned).strip()

    # Try direct parse first
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Try to find the first { ... } block
    match = re.search(r'\{.*\}', cleaned, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    logger.warning(f"Could not parse LLM JSON output. Raw: {raw[:300]}")
    return None


# ---------------------------------------------------------------------------
# Document weight calculation
# ---------------------------------------------------------------------------

def compute_document_weight(concepts: List[Dict]) -> float:
    """
    Compute the document weight from its concept hierarchy.
    weight = Σ(concept_weight_value × subtopic_count) for all concepts.
    Minimum weight = 1.0 to avoid zero-weight documents.
    """
    total = 0.0
    for concept in concepts:
        concept_w = WEIGHT_VALUES.get(concept.get("weight", "supporting"), 2)
        subtopic_count = len(concept.get("subtopics", []))
        total += concept_w * max(subtopic_count, 1)
    return max(1.0, total)


# ---------------------------------------------------------------------------
# Main extraction function (called as background task)
# ---------------------------------------------------------------------------

async def extract_and_store_concepts(
    user_id: str,
    course_id: str,
    doc_id: str,
    filename: str,
    document_text: str,
    api_key: Optional[str] = None,
):
    """
    Extract concept hierarchy from document text and store in mastery_v2_db.

    This is the async background task wired to document upload (Task 1.3).
    Sets extraction_status = 'processing' at start, 'complete' on success,
    'failed' on error.

    Args:
        user_id: User identifier
        course_id: Course identifier
        doc_id: Document UUID (already registered in course_documents)
        filename: Original filename (for logging)
        document_text: Full extracted text from the document
        api_key: User's Groq API key (optional — falls back to system key)
    """
    logger.info(f"[ConceptExtraction] Starting for doc={filename} (doc_id={doc_id})")
    mastery_v2_db.set_extraction_status(user_id, course_id, doc_id, "processing")

    try:
        # 1. Get LLM
        from models.global_models import get_llm
        llm = get_llm(api_key=api_key)

        # 2. Build prompt and call LLM
        prompt = _build_extraction_prompt(document_text)

        try:
            response = await llm.ainvoke([
                {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ])
            raw_output = response.content if hasattr(response, "content") else str(response)
        except Exception as e:
            # Some LLM wrappers don't support list-format messages
            logger.warning(f"ainvoke with messages failed, trying plain string: {e}")
            full_prompt = f"{EXTRACTION_SYSTEM_PROMPT}\n\n{prompt}"
            response = await llm.ainvoke(full_prompt)
            raw_output = response.content if hasattr(response, "content") else str(response)

        logger.info(f"[ConceptExtraction] LLM responded ({len(raw_output)} chars)")

        # 3. Parse JSON
        parsed = _parse_llm_json(raw_output)
        if not parsed or "concepts" not in parsed:
            raise ValueError(f"LLM returned unparseable concept data: {raw_output[:200]}")

        concepts = parsed["concepts"]
        if not concepts:
            raise ValueError("LLM returned empty concept list")

        logger.info(f"[ConceptExtraction] Extracted {len(concepts)} concepts from {filename}")

        # 4. Insert into database
        inserted_concepts = 0
        inserted_subtopics = 0

        for concept_data in concepts:
            concept_name = concept_data.get("name", "").strip()
            concept_weight = concept_data.get("weight", "supporting")
            subtopics = concept_data.get("subtopics", [])

            if not concept_name:
                continue

            # Validate weight
            if concept_weight not in WEIGHT_VALUES:
                concept_weight = "supporting"

            # Insert tier-2 concept node
            concept_id = mastery_v2_db.insert_concept(
                user_id=user_id,
                course_id=course_id,
                doc_id=doc_id,
                concept_name=concept_name,
                tier=2,
                weight=concept_weight,
                parent_concept_id=None,
            )
            inserted_concepts += 1

            # Insert tier-3 subtopic nodes
            for sub in subtopics:
                sub_name = sub.get("name", "").strip()
                sub_weight = sub.get("weight", "supporting")

                if not sub_name:
                    continue
                if sub_weight not in WEIGHT_VALUES:
                    sub_weight = "supporting"

                mastery_v2_db.insert_concept(
                    user_id=user_id,
                    course_id=course_id,
                    doc_id=doc_id,
                    concept_name=sub_name,
                    tier=3,
                    weight=sub_weight,
                    parent_concept_id=concept_id,
                )
                inserted_subtopics += 1

        logger.info(
            f"[ConceptExtraction] Stored {inserted_concepts} concepts, "
            f"{inserted_subtopics} subtopics for doc={filename}"
        )

        # 5. Compute and store document weight
        doc_weight = compute_document_weight(concepts)
        mastery_v2_db.set_extraction_status(
            user_id, course_id, doc_id, "complete",
            document_weight=doc_weight
        )

        logger.info(
            f"[ConceptExtraction] ✅ Complete — doc={filename}, "
            f"weight={doc_weight:.1f}, "
            f"concepts={inserted_concepts}, subtopics={inserted_subtopics}"
        )

    except Exception as e:
        logger.error(f"[ConceptExtraction] ❌ Failed for doc={filename}: {e}")
        mastery_v2_db.set_extraction_status(user_id, course_id, doc_id, "failed")
