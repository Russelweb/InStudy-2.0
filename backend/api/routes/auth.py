"""
Authentication API routes for user registration, login, and session management.
"""

from fastapi import APIRouter, HTTPException, Depends, Request, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
import logging

from models.auth_models import LoginRequest, RegisterRequest, AuthResult, User
from services.auth_service import auth_service, get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBearer(auto_error=False)

@router.post("/register", response_model=AuthResult)
async def register(request: RegisterRequest):
    """Register a new user account"""
    try:
        result = auth_service.register_user(
            email=request.email,
            password=request.password,
            confirm_password=request.confirm_password
        )
        
        if not result.success:
            raise HTTPException(status_code=400, detail=result.error_message)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration endpoint error: {e}")
        raise HTTPException(status_code=500, detail="Registration failed")

@router.post("/login", response_model=AuthResult)
async def login(request: LoginRequest):
    """Authenticate user and create session"""
    try:
        result = auth_service.login_user(
            email=request.email,
            password=request.password
        )
        
        if not result.success:
            raise HTTPException(status_code=401, detail=result.error_message)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login endpoint error: {e}")
        raise HTTPException(status_code=500, detail="Login failed")

@router.post("/logout")
async def logout(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    """Logout user by deleting session"""
    try:
        if not credentials:
            raise HTTPException(status_code=401, detail="No token provided")
        
        token = credentials.credentials
        success = auth_service.logout_user(token)
        
        if not success:
            raise HTTPException(status_code=400, detail="Logout failed")
        
        return {"message": "Logged out successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Logout endpoint error: {e}")
        raise HTTPException(status_code=500, detail="Logout failed")

@router.get("/me", response_model=User)
async def get_me(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    """Get current user information"""
    try:
        if not credentials:
            raise HTTPException(status_code=401, detail="No token provided")
        
        token = credentials.credentials
        user = auth_service.get_current_user(token)
        
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        
        return user
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get me endpoint error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get user info")

@router.post("/verify")
async def verify_token(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    """Verify if token is valid"""
    try:
        if not credentials:
            return {"valid": False, "message": "No token provided"}
        
        token = credentials.credentials
        user = auth_service.get_current_user(token)
        
        if user:
            return {"valid": True, "user_id": user.id, "email": user.email}
        else:
            return {"valid": False, "message": "Invalid or expired token"}
        
    except Exception as e:
        logger.error(f"Token verification error: {e}")
        return {"valid": False, "message": "Verification failed"}

# Dependency to get current user for protected routes
async def get_authenticated_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> User:
    """Dependency to get authenticated user for protected routes"""
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    token = credentials.credentials
    user = auth_service.get_current_user(token)
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    return user