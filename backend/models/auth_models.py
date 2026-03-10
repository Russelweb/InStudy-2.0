"""
Authentication models for user management and session handling.
"""

from pydantic import BaseModel, EmailStr, validator
from typing import Optional
from datetime import datetime

class User(BaseModel):
    """User model for authenticated users"""
    id: int
    email: str
    is_admin: bool = False
    created_at: Optional[datetime] = None
    last_login: Optional[datetime] = None

class LoginRequest(BaseModel):
    """Request model for user login"""
    email: EmailStr
    password: str
    
    @validator('password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        return v

class RegisterRequest(BaseModel):
    """Request model for user registration"""
    email: EmailStr
    password: str
    confirm_password: str
    
    @validator('password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        return v
    
    @validator('confirm_password')
    def passwords_match(cls, v, values):
        if 'password' in values and v != values['password']:
            raise ValueError('Passwords do not match')
        return v

class AuthResult(BaseModel):
    """Result model for authentication operations"""
    success: bool
    user_id: Optional[int] = None
    session_token: Optional[str] = None
    error_message: Optional[str] = None
    user: Optional[User] = None

class SessionInfo(BaseModel):
    """Session information model"""
    token: str
    user_id: int
    created_at: datetime
    expires_at: datetime