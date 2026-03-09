from fastapi import HTTPException, Header
from typing import Optional

# Simplified auth for MVP - replace with Firebase in production
def verify_token(authorization: Optional[str] = Header(None)):
    """Verify user token - simplified for MVP"""
    if not authorization:
        return "demo_user"  # Allow demo access
    
    # In production, verify Firebase token here
    token = authorization.replace("Bearer ", "")
    return token  # Return user_id

def get_current_user(authorization: Optional[str] = Header(None)):
    """Get current authenticated user"""
    return verify_token(authorization)
