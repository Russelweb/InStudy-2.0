import requests
import hashlib
import os
import logging
from typing import Optional, Dict, List
from pathlib import Path
import json
import re

logger = logging.getLogger(__name__)

class ImageService:
    """
    Service for generating relevant images for flashcards using local image library.
    Fast, reliable, and no external dependencies.
    """
    
    def __init__(self):
        # Path to local images directory
        self.images_dir = Path(__file__).parent.parent / "static" / "images"
        
        # Cache directory for stock images
        self.cache_dir = Path(__file__).parent.parent / "image_cache"
        self.cache_dir.mkdir(exist_ok=True)
        
        # Create images directory structure if it doesn't exist
        self.images_dir.mkdir(parents=True, exist_ok=True)
        for category in ["science", "math", "technology", "history", "language", "general"]:
            (self.images_dir / category).mkdir(exist_ok=True)
        
        # Educational topic to image mappings
        self.topic_mappings = {
            # Science topics
            "dna": "science/dna.png",
            "biology": "science/biology.png", 
            "chemistry": "science/chemistry.png",
            "physics": "science/physics.png",
            "photosynthesis": "science/plant.png",
            "cell": "science/cell.png",
            "atom": "science/atom.png",
            "molecule": "science/molecule.png",
            
            # Math topics
            "calculus": "math/calculus.png",
            "algebra": "math/algebra.png",
            "geometry": "math/geometry.png",
            "statistics": "math/statistics.png",
            "graph": "math/graph.png",
            "equation": "math/equation.png",
            
            # Technology topics
            "programming": "technology/programming.png",
            "computer": "technology/computer.png",
            "algorithm": "technology/algorithm.png",
            "database": "technology/database.png",
            "network": "technology/network.png",
            
            # History topics
            "history": "history/history.png",
            "ancient": "history/ancient.png",
            "civilization": "history/civilization.png",
            
            # Language topics
            "language": "language/language.png",
            "literature": "language/literature.png",
            "writing": "language/writing.png",
            "grammar": "language/grammar.png"
        }
        
        # Emoji fallbacks for when local images aren't available
        self.emoji_fallbacks = {
            # Science & Technology
            "science": "🔬", "chemistry": "⚗️", "physics": "⚛️", "biology": "🧬",
            "computer": "💻", "programming": "👨‍💻", "code": "💻", "algorithm": "🔄",
            "data": "📊", "database": "🗄️", "network": "🌐", "internet": "🌍",
            "dna": "🧬", "genetics": "🧬", "photosynthesis": "🌱", "cell": "🦠",
            "atom": "⚛️", "molecule": "⚛️", "electron": "⚛️", "energy": "⚡",
            "software": "💻", "hardware": "🔧", "technology": "⚙️", "tech": "⚙️",
            "artificial": "🤖", "intelligence": "🤖", "ai": "🤖", "machine": "🤖",
            "learning": "📚", "neural": "🧠", "brain": "🧠", "analysis": "📊",
            
            # Mathematics
            "math": "📐", "mathematics": "📐", "geometry": "📐", "algebra": "🔢",
            "statistics": "📈", "calculus": "∫", "equation": "🔢", "graph": "📊",
            "number": "🔢", "fraction": "½", "percentage": "📊", "probability": "🎲",
            
            # Languages & Literature
            "language": "🗣️", "english": "📚", "literature": "📖", "writing": "✍️",
            "grammar": "📝", "vocabulary": "📖", "reading": "👀", "book": "📚",
            
            # History & Social Studies
            "history": "🏛️", "ancient": "🏺", "war": "⚔️", "culture": "🎭",
            "geography": "🗺️", "country": "🏳️", "politics": "🏛️", "economy": "💰",
            "democracy": "🗳️", "government": "🏛️", "society": "👥", "civilization": "🏛️",
            
            # Business & IT
            "business": "💼", "company": "🏢", "organization": "🏢", "corporate": "🏢",
            "management": "👔", "strategy": "📋", "planning": "📅", "project": "📋",
            "solution": "💡", "service": "🛠️", "client": "👤", "customer": "👤",
            "market": "📈", "sales": "💰", "revenue": "💰", "profit": "💰",
            "innovation": "💡", "development": "🔧", "design": "🎨", "creative": "💡",
            
            # Arts & Music
            "art": "🎨", "music": "🎵", "painting": "🖼️", "drawing": "✏️",
            "design": "🎨", "creative": "💡", "color": "🌈", "sound": "🔊",
            
            # General Academic
            "study": "📚", "learn": "🎓", "education": "🎓", "school": "🏫",
            "university": "🎓", "research": "🔍", "analysis": "🔍", "theory": "💭",
            "concept": "💡", "idea": "💡", "principle": "⚖️", "method": "🔧",
            "process": "⚙️", "system": "🔧", "framework": "🏗️", "model": "📐"
        }
    
    def get_flashcard_image(self, front_text: str, back_text: str) -> Dict[str, str]:
        """
        Get relevant image for flashcard content.
        Returns dict with image_url, image_type, and alt_text.
        """
        try:
            # Extract keywords from both front and back text
            keywords = self._extract_keywords(front_text + " " + back_text)
            
            # Try local image first (if available)
            if local_result := self._get_local_image(keywords):
                return local_result
            
            # Try icon (fastest and most reliable)
            if icon_result := self._get_educational_icon(keywords):
                return icon_result
            
            # Use default educational images (reliable fallback)
            return self._get_default_educational_image(keywords, front_text)
            
        except Exception as e:
            logger.error(f"Error getting flashcard image: {e}")
            return self._get_default_educational_image([], front_text)
    
    def _get_local_image(self, keywords: List[str]) -> Optional[Dict[str, str]]:
        """Get local image based on keywords"""
        for keyword in keywords:
            # Check topic mappings first
            if keyword in self.topic_mappings:
                image_path = self.images_dir / self.topic_mappings[keyword]
                if image_path.exists():
                    # Return relative path for web serving
                    relative_path = f"/static/images/{self.topic_mappings[keyword]}"
                    return {
                        "image_url": relative_path,
                        "image_type": "local_image",
                        "alt_text": f"Educational image for {keyword}"
                    }
            
            # Check for direct file matches in categories
            for category in ["science", "math", "technology", "history", "language", "general"]:
                category_dir = self.images_dir / category
                if category_dir.exists():
                    # Look for files matching the keyword
                    for ext in [".png", ".jpg", ".jpeg", ".gif", ".svg"]:
                        image_file = category_dir / f"{keyword}{ext}"
                        if image_file.exists():
                            relative_path = f"/static/images/{category}/{keyword}{ext}"
                            return {
                                "image_url": relative_path,
                                "image_type": "local_image", 
                                "alt_text": f"Educational image for {keyword}"
                            }
        
        return None
    
    def _extract_keywords(self, text: str) -> List[str]:
        """Extract relevant keywords from flashcard text"""
        # Convert to lowercase and remove punctuation
        clean_text = re.sub(r'[^\w\s]', ' ', text.lower())
        words = clean_text.split()
        
        # Filter out common words and keep relevant terms
        stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'what', 'which', 'who', 'when', 'where', 'why', 'how'}
        
        keywords = [word for word in words if len(word) > 2 and word not in stop_words]
        return keywords[:5]  # Top 5 keywords
    
    def _get_default_educational_image(self, keywords: List[str], front_text: str) -> Dict[str, str]:
        """Get default educational images based on context"""
        
        # Default educational images with both emoji and SVG options
        default_images = [
            {"name": "study", "emoji": "📚", "svg": "/static/images/general/study.svg", "alt": "Study book"},
            {"name": "education", "emoji": "🎓", "svg": "/static/images/general/education.svg", "alt": "Education cap"},
            {"name": "idea", "emoji": "💡", "svg": "/static/images/general/idea.svg", "alt": "Learning idea"},
            {"name": "research", "emoji": "🔍", "svg": "/static/images/general/research.svg", "alt": "Research"},
            {"name": "notes", "emoji": "📝", "svg": "/static/images/general/notes.svg", "alt": "Note taking"},
            {"name": "brain", "emoji": "🧠", "svg": "/static/images/general/brain.svg", "alt": "Brain/thinking"},
            {"name": "achievement", "emoji": "⭐", "svg": "/static/images/general/achievement.svg", "alt": "Achievement"},
            {"name": "target", "emoji": "🎯", "svg": "/static/images/general/target.svg", "alt": "Goal/target"},
            {"name": "question", "emoji": "❓", "svg": "/static/images/general/question.svg", "alt": "Question mark"},
            {"name": "book", "emoji": "📖", "svg": "/static/images/general/book.svg", "alt": "Learning book"},
        ]
        
        # Try to match context for better defaults
        text_lower = (front_text + " " + " ".join(keywords)).lower()
        
        # Context-based selection with SVG preference
        context_mappings = [
            (["question", "what", "how", "why", "when", "where"], "question"),
            (["definition", "define", "meaning", "concept"], "book"),
            (["process", "step", "method", "procedure"], "target"),
            (["formula", "equation", "calculate"], "brain"),
            (["theory", "principle", "law", "rule"], "education"),
            (["example", "instance", "case"], "study"),
            (["research", "investigate", "analyze"], "research"),
            (["note", "remember", "memorize"], "notes"),
            (["goal", "objective", "aim"], "target"),
            (["success", "achievement", "accomplish"], "achievement"),
        ]
        
        # Check for context matches
        for keywords_list, image_name in context_mappings:
            if any(word in text_lower for word in keywords_list):
                selected = next((img for img in default_images if img["name"] == image_name), default_images[0])
                
                # Check if SVG file exists, otherwise use emoji
                svg_path = Path(__file__).parent.parent / "static" / "images" / "general" / f"{selected['name']}.svg"
                if svg_path.exists():
                    return {
                        "image_url": selected["svg"],
                        "image_type": "svg_image",
                        "alt_text": selected["alt"]
                    }
                else:
                    return {
                        "image_url": selected["emoji"],
                        "image_type": "emoji",
                        "alt_text": selected["alt"]
                    }
        
        # Use a consistent default based on text hash
        import hashlib
        text_hash = int(hashlib.md5(front_text.encode()).hexdigest(), 16)
        selected = default_images[text_hash % len(default_images)]
        
        # Check if SVG file exists, otherwise use emoji
        svg_path = Path(__file__).parent.parent / "static" / "images" / "general" / f"{selected['name']}.svg"
        if svg_path.exists():
            return {
                "image_url": selected["svg"],
                "image_type": "svg_image",
                "alt_text": selected["alt"]
            }
        else:
            return {
                "image_url": selected["emoji"],
                "image_type": "emoji", 
                "alt_text": selected["alt"]
            }
    
    def _get_educational_icon(self, keywords: List[str]) -> Optional[Dict[str, str]]:
        """Get educational icon based on keywords"""
        for keyword in keywords:
            if keyword in self.emoji_fallbacks:
                return {
                    "image_url": self.emoji_fallbacks[keyword],  # Just the emoji, not a data URL
                    "image_type": "emoji",
                    "alt_text": f"Icon representing {keyword}"
                }
        return None
    
    def _generate_text_visual(self, text: str) -> Dict[str, str]:
        """Generate a simple text-based visual as fallback (deprecated - use _get_default_educational_image instead)"""
        # Create a simple badge-style visual
        short_text = text[:20] + "..." if len(text) > 20 else text
        
        return {
            "image_url": f"📚 {short_text}",  # Just the text, not a data URL
            "image_type": "text_badge",
            "alt_text": f"Text badge for: {short_text}"
        }
    
    def get_subject_icon(self, subject: str) -> str:
        """Get subject-specific icon"""
        subject_lower = subject.lower()
        
        subject_icons = {
            "mathematics": "📐",
            "science": "🔬",
            "history": "🏛️",
            "literature": "📚",
            "language": "🗣️",
            "computer": "💻",
            "art": "🎨",
            "music": "🎵",
            "geography": "🗺️",
            "biology": "🧬",
            "chemistry": "⚗️",
            "physics": "⚛️"
        }
        
        for key, icon in subject_icons.items():
            if key in subject_lower:
                return icon
        
        return "📚"  # Default education icon