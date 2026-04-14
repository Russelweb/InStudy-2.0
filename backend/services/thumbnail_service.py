import os
import fitz  # PyMuPDF
from PIL import Image
from pathlib import Path
from config import settings
from utils.file_utils import get_absolute_path
import logging

logger = logging.getLogger(__name__)

class ThumbnailService:
    def __init__(self):
        self.upload_dir = Path(get_absolute_path(settings.UPLOAD_DIR))

    def get_course_thumbnail(self, user_id: str, course_id: str) -> str:
        """
        Get path to course thumbnail.
        Generates it from the first document if it doesn't exist.
        """
        course_dir = self.upload_dir / user_id / course_id
        if not course_dir.exists():
            return None

        thumbnail_path = course_dir / "thumbnail.png"
        
        # If exists, return it
        if thumbnail_path.exists():
            return str(thumbnail_path)

        # Try to generate
        try:
            # Find first document
            docs = [f for f in course_dir.iterdir() if f.is_file() and f.suffix.lower() in [".pdf", ".docx", ".txt"] and f.name != "thumbnail.png"]
            if not docs:
                return None
            
            # Sort to be deterministic
            first_doc = sorted(docs)[0]
            
            if first_doc.suffix.lower() == ".pdf":
                # Convert PDF first page to image
                doc = fitz.open(str(first_doc))
                if len(doc) > 0:
                    page = doc[0]
                    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # High res
                    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                    
                    # Crop/Resize to 400x300 center?
                    # For now just save
                    img.save(str(thumbnail_path), "PNG")
                    doc.close()
                    return str(thumbnail_path)
                doc.close()
            
            # Fallback for txt/docx (could generate a text-based thumb, but for now skip)
            return None

        except Exception as e:
            logger.error(f"Failed to generate thumbnail for {course_id}: {e}")
            return None

thumbnail_service = ThumbnailService()
