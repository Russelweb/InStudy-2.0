"""
Authentication service layer for user management and session handling.
"""

import os
import re
from pathlib import Path
from typing import Optional
import logging

from database.auth_db import auth_db
from models.auth_models import AuthResult, User, LoginRequest, RegisterRequest

logger = logging.getLogger(__name__)

class AuthService:
    """Service layer for authentication operations"""
    
    def __init__(self):
        self.auth_db = auth_db
    
    def register_user(self, email: str, password: str, confirm_password: str) -> AuthResult:
        """Register a new user account"""
        try:
            # Validate input
            if not self.validate_email(email):
                return AuthResult(
                    success=False,
                    error_message="Invalid email format"
                )
            
            if not self.validate_password(password):
                return AuthResult(
                    success=False,
                    error_message="Password must be at least 8 characters long"
                )
            
            if password != confirm_password:
                return AuthResult(
                    success=False,
                    error_message="Passwords do not match"
                )
            
            # Create user
            user_id = self.auth_db.create_user(email, password)
            
            if user_id is None:
                return AuthResult(
                    success=False,
                    error_message="User already exists or registration failed"
                )
            
            # Create session
            session_token = self.auth_db.create_session(user_id)
            
            if not session_token:
                return AuthResult(
                    success=False,
                    error_message="Failed to create session"
                )
            
            # Create user directories
            self.create_user_directories(user_id)
            
            # Get user info
            user_data = self.auth_db.get_user_by_id(user_id)
            user = User(**user_data) if user_data else None
            
            logger.info(f"User registered successfully: {email}")
            
            return AuthResult(
                success=True,
                user_id=user_id,
                session_token=session_token,
                user=user
            )
            
        except Exception as e:
            logger.error(f"Registration error: {e}")
            return AuthResult(
                success=False,
                error_message="Registration failed due to server error"
            )
    
    def login_user(self, email: str, password: str) -> AuthResult:
        """Authenticate user and create session"""
        try:
            # Authenticate user
            user_data = self.auth_db.authenticate_user(email, password)
            
            if not user_data:
                return AuthResult(
                    success=False,
                    error_message="Invalid email or password"
                )
            
            # Create session
            session_token = self.auth_db.create_session(user_data['id'])
            
            if not session_token:
                return AuthResult(
                    success=False,
                    error_message="Failed to create session"
                )
            
            # Get full user info
            full_user_data = self.auth_db.get_user_by_id(user_data['id'])
            user = User(**full_user_data) if full_user_data else None
            
            logger.info(f"User logged in successfully: {email}")
            
            return AuthResult(
                success=True,
                user_id=user_data['id'],
                session_token=session_token,
                user=user
            )
            
        except Exception as e:
            logger.error(f"Login error: {e}")
            return AuthResult(
                success=False,
                error_message="Login failed due to server error"
            )
    
    def logout_user(self, token: str) -> bool:
        """Logout user by deleting session"""
        try:
            return self.auth_db.delete_session(token)
        except Exception as e:
            logger.error(f"Logout error: {e}")
            return False
    
    def get_current_user(self, token: str) -> Optional[User]:
        """Get current user from session token"""
        try:
            session_data = self.auth_db.verify_session(token)
            
            if not session_data:
                return None
            
            user_data = self.auth_db.get_user_by_id(session_data['user_id'])
            
            if user_data:
                return User(**user_data)
            
            return None
            
        except Exception as e:
            logger.error(f"Get current user error: {e}")
            return None
    
    def create_user_directories(self, user_id: int) -> bool:
        """Create user-specific directories for file isolation"""
        try:
            # Create upload directory
            upload_path = Path(f"backend/uploads/{user_id}")
            upload_path.mkdir(parents=True, exist_ok=True)
            
            # Set directory permissions (owner read/write only)
            os.chmod(upload_path, 0o700)
            
            # Ensure vector store base directory exists
            vector_base_path = Path("backend/vector_store")
            vector_base_path.mkdir(parents=True, exist_ok=True)
            
            logger.info(f"Created directories for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error creating user directories: {e}")
            return False
    
    def validate_email(self, email: str) -> bool:
        """Validate email format"""
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return re.match(pattern, email) is not None
    
    def validate_password(self, password: str) -> bool:
        """Validate password requirements"""
        return len(password) >= 8
    
    def cleanup_expired_sessions(self):
        """Clean up expired sessions"""
        try:
            self.auth_db.cleanup_expired_sessions()
        except Exception as e:
            logger.error(f"Session cleanup error: {e}")

# Global instance
auth_service = AuthService()

# Dependency for FastAPI
def get_current_user(token: str) -> Optional[User]:
    """FastAPI dependency to get current user"""
    return auth_service.get_current_user(token)

def verify_token(token: str) -> Optional[User]:
    """Verify session token and return user (for backward compatibility)"""
    return auth_service.get_current_user(token)