"""
Concept normalization and validation utilities.
Ensures consistent concept naming across the mastery system.
"""

import re
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)

# Common stop words and noise to filter out
STOP_WORDS = {
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
    'could', 'may', 'might', 'must', 'can', 'e.g.', 'etc.', 'i.e.', 'vs', 'vs.'
}

# Concept aliases for common variations
CONCEPT_ALIASES = {
    'ml': 'machine learning',
    'ai': 'artificial intelligence',
    'nn': 'neural network',
    'dl': 'deep learning',
    'nlp': 'natural language processing',
    'cv': 'computer vision',
    'rl': 'reinforcement learning',
    'cnn': 'convolutional neural network',
    'rnn': 'recurrent neural network',
    'lstm': 'long short-term memory',
    'gru': 'gated recurrent unit',
    'gan': 'generative adversarial network',
    'vae': 'variational autoencoder',
    'bert': 'bidirectional encoder representations from transformers',
    'gpt': 'generative pre-trained transformer',
}


def normalize_concept(concept: str) -> Optional[str]:
    """
    Normalize a concept name for consistent storage and retrieval.
    
    Args:
        concept: Raw concept string from LLM or user input
        
    Returns:
        Normalized concept string, or None if invalid
    """
    if not concept or not isinstance(concept, str):
        return None
    
    # Convert to lowercase
    normalized = concept.lower().strip()
    
    # Remove extra whitespace
    normalized = re.sub(r'\s+', ' ', normalized)
    
    # Remove special characters except spaces, hyphens, and parentheses
    normalized = re.sub(r'[^a-z0-9\s\-()]', '', normalized)
    
    # Check if it's an alias
    if normalized in CONCEPT_ALIASES:
        normalized = CONCEPT_ALIASES[normalized]
    
    # Remove stop words from multi-word concepts
    words = normalized.split()
    if len(words) > 1:
        words = [w for w in words if w not in STOP_WORDS]
        normalized = ' '.join(words)
    
    # Final cleanup
    normalized = normalized.strip()
    
    # Validate length (increased to 255 to handle longer concept phrases/definitions)
    if len(normalized) < 2 or len(normalized) > 255:
        logger.warning(f"Concept rejected (invalid length): '{concept}' -> '{normalized}'")
        return None
    
    # Reject if it's just a number
    if normalized.isdigit():
        logger.warning(f"Concept rejected (just a number): '{concept}'")
        return None
    
    # Reject common noise patterns
    noise_patterns = [
        r'^chapter\s+\d+$',
        r'^section\s+\d+$',
        r'^page\s+\d+$',
        r'^example\s+\d+$',
        r'^figure\s+\d+$',
        r'^table\s+\d+$',
    ]
    
    for pattern in noise_patterns:
        if re.match(pattern, normalized):
            logger.warning(f"Concept rejected (noise pattern): '{concept}'")
            return None
    
    return normalized


def normalize_concepts(concepts: List[str]) -> List[str]:
    """
    Normalize a list of concepts and remove duplicates.
    
    Args:
        concepts: List of raw concept strings
        
    Returns:
        List of normalized, unique concepts
    """
    normalized = []
    seen = set()
    
    for concept in concepts:
        norm = normalize_concept(concept)
        if norm and norm not in seen:
            normalized.append(norm)
            seen.add(norm)
    
    return normalized


def validate_concept(concept: str) -> bool:
    """
    Validate if a concept string is acceptable.
    
    Args:
        concept: Concept string to validate
        
    Returns:
        True if valid, False otherwise
    """
    return normalize_concept(concept) is not None


def merge_similar_concepts(concepts: List[str], threshold: float = 0.85) -> dict:
    """
    Identify similar concepts that should potentially be merged.
    Uses simple string similarity (Levenshtein distance).
    
    Args:
        concepts: List of concept strings
        threshold: Similarity threshold (0-1)
        
    Returns:
        Dictionary mapping similar concepts to suggested canonical form
    """
    from difflib import SequenceMatcher
    
    suggestions = {}
    concepts_sorted = sorted(concepts, key=len, reverse=True)
    
    for i, concept1 in enumerate(concepts_sorted):
        for concept2 in concepts_sorted[i+1:]:
            similarity = SequenceMatcher(None, concept1, concept2).ratio()
            if similarity >= threshold:
                # Prefer the longer, more descriptive version
                canonical = concept1 if len(concept1) >= len(concept2) else concept2
                other = concept2 if canonical == concept1 else concept1
                suggestions[other] = canonical
                logger.info(f"Similar concepts detected: '{other}' -> '{canonical}' (similarity: {similarity:.2f})")
    
    return suggestions


def extract_concept_from_text(text: str, max_concepts: int = 3) -> List[str]:
    """
    Extract potential concepts from a text string using simple heuristics.
    This is a fallback when LLM extraction fails.
    
    Args:
        text: Text to extract concepts from
        max_concepts: Maximum number of concepts to extract
        
    Returns:
        List of extracted concepts
    """
    # Look for capitalized phrases (likely proper nouns/concepts)
    capitalized = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', text)
    
    # Look for technical terms (words with numbers, hyphens, or mixed case)
    technical = re.findall(r'\b[A-Za-z]+[-]?[A-Za-z0-9]+\b', text)
    
    # Combine and normalize
    candidates = capitalized + technical
    normalized = normalize_concepts(candidates)
    
    # Return top N by frequency
    from collections import Counter
    concept_counts = Counter(normalized)
    return [concept for concept, _ in concept_counts.most_common(max_concepts)]


def get_concept_category(concept: str) -> str:
    """
    Attempt to categorize a concept into broad domains.
    
    Args:
        concept: Normalized concept string
        
    Returns:
        Category string (e.g., 'math', 'programming', 'science')
    """
    concept_lower = concept.lower()
    
    # Math/Statistics
    math_keywords = ['calculus', 'algebra', 'geometry', 'statistics', 'probability', 
                     'derivative', 'integral', 'matrix', 'vector', 'equation']
    if any(kw in concept_lower for kw in math_keywords):
        return 'mathematics'
    
    # Computer Science/Programming
    cs_keywords = ['algorithm', 'data structure', 'programming', 'code', 'function',
                   'class', 'object', 'array', 'loop', 'recursion', 'sorting']
    if any(kw in concept_lower for kw in cs_keywords):
        return 'computer_science'
    
    # Machine Learning/AI
    ml_keywords = ['learning', 'neural', 'network', 'model', 'training', 'prediction',
                   'classification', 'regression', 'clustering', 'optimization']
    if any(kw in concept_lower for kw in ml_keywords):
        return 'machine_learning'
    
    # Physics
    physics_keywords = ['quantum', 'mechanics', 'energy', 'force', 'motion', 'wave',
                        'particle', 'relativity', 'thermodynamics', 'electromagnetism']
    if any(kw in concept_lower for kw in physics_keywords):
        return 'physics'
    
    # Biology
    bio_keywords = ['cell', 'dna', 'protein', 'gene', 'evolution', 'organism',
                    'biology', 'anatomy', 'physiology', 'ecology']
    if any(kw in concept_lower for kw in bio_keywords):
        return 'biology'
    
    # Chemistry
    chem_keywords = ['molecule', 'atom', 'reaction', 'compound', 'element', 'bond',
                     'chemistry', 'organic', 'inorganic', 'catalyst']
    if any(kw in concept_lower for kw in chem_keywords):
        return 'chemistry'
    
    return 'general'


# Export main functions
__all__ = [
    'normalize_concept',
    'normalize_concepts',
    'validate_concept',
    'merge_similar_concepts',
    'extract_concept_from_text',
    'get_concept_category',
]
