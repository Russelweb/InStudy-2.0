import os
import re
import unicodedata
from pathlib import Path

SAFE_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$")


def validate_safe_id(value: str, field_name: str = "id") -> str:
    """Validate route IDs used in filesystem paths."""
    value = str(value or "").strip()
    if not SAFE_ID_PATTERN.fullmatch(value):
        raise ValueError(f"Invalid {field_name}")
    return value

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


def safe_join(base_path: str, *parts: str) -> str:
    """Join paths and ensure the result stays inside base_path."""
    base = Path(base_path).resolve()
    candidate = base.joinpath(*parts).resolve()

    if candidate != base and base not in candidate.parents:
        raise ValueError("Path escapes allowed directory")

    return str(candidate)


def get_upload_root() -> str:
    from config import settings
    return get_absolute_path(settings.UPLOAD_DIR)


def get_vector_store_root() -> str:
    from config import settings
    return get_absolute_path(settings.VECTOR_STORE_DIR)


def get_user_course_dir(user_id: str, course_id: str) -> str:
    user_id = validate_safe_id(user_id, "user_id")
    course_id = validate_safe_id(course_id, "course_id")
    return safe_join(get_upload_root(), user_id, course_id)


def get_user_file_path(user_id: str, course_id: str, filename: str) -> str:
    user_dir = get_user_course_dir(user_id, course_id)
    filename = sanitize_filename(filename)
    return safe_join(user_dir, filename)


def get_user_annotations_path(user_id: str, course_id: str, filename: str) -> str:
    user_dir = get_user_course_dir(user_id, course_id)
    filename = sanitize_filename(filename)
    return safe_join(user_dir, f"{filename}.annotations.json")


def get_vector_store_path(user_id: str, course_id: str) -> str:
    user_id = validate_safe_id(user_id, "user_id")
    course_id = validate_safe_id(course_id, "course_id")
    return safe_join(get_vector_store_root(), f"{user_id}_{course_id}")
