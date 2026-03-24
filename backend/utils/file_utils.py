import os
import re
import unicodedata

def sanitize_filename(filename: str, max_length: int = 100) -> str:
    """
    Sanitize and truncate a filename for safe storage on any filesystem.
    Removes special characters and ensures it doesn't exceed max_length.
    """
    # Separate name and extension
    name, ext = os.path.splitext(filename)
    
    # Normalize unicode characters
    name = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode('ascii')
    
    # Remove special characters, keep alphanumeric, underscore, dot, and hyphen
    name = re.sub(r'[^\w\s\.-]', '', name)
    
    # Replace spaces with underscores
    name = name.replace(' ', '_')
    
    # Truncate to reasonable length (leaving room for extension)
    if len(name) > (max_length - len(ext)):
        name = name[:max_length - len(ext)]
    
    # Clean up trailing/leading dots/underscores
    name = name.strip('._')
    
    # Ensure name is not empty
    if not name:
        name = "unnamed_file"
        
    return f"{name}{ext}"

def get_absolute_path(relative_path: str) -> str:
    """Get absolute path relative to the backend directory"""
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.abspath(os.path.join(base_dir, relative_path))
