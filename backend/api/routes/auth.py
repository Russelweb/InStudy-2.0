"""
Authentication API routes for user registration, login, and session management.
"""

from fastapi import APIRouter, HTTPException, Depends, Request, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
import logging

from models.auth_models import LoginRequest, RegisterRequest, AuthResult, User, GroqKeyRequest
from services.auth_service import auth_service, get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBearer(auto_error=False)

@router.post("/register", response_model=AuthResult)
async def register(request: RegisterRequest, response: Response):
    """Register a new user account"""
    try:
        result = auth_service.register_user(
            email=request.email,
            password=request.password,
            confirm_password=request.confirm_password
        )
        
        if not result.success:
            raise HTTPException(status_code=400, detail=result.error_message)
        
        # Set session token in HttpOnly cookie
        response.set_cookie(
            key="session_token",
            value=result.session_token,
            httponly=True,
            max_age=90 * 24 * 60 * 60,  # 90 days
            samesite="lax",
            secure=False,  # Set to True in production with HTTPS
            path="/",      # Ensure cookie is sent to all paths
        )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration endpoint error: {e}")
        raise HTTPException(status_code=500, detail="Registration failed")

@router.post("/login", response_model=AuthResult)
async def login(request: LoginRequest, response: Response):
    """Authenticate user and create session"""
    try:
        result = auth_service.login_user(
            email=request.email,
            password=request.password
        )
        
        if not result.success:
            raise HTTPException(status_code=401, detail=result.error_message)
        
        # Set session token in HttpOnly cookie
        response.set_cookie(
            key="session_token",
            value=result.session_token,
            httponly=True,
            max_age=90 * 24 * 60 * 60,  # 90 days
            samesite="lax",
            secure=False,  # Set to True in production with HTTPS
            path="/",      # Ensure cookie is sent to all paths
        )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login endpoint error: {e}")
        raise HTTPException(status_code=500, detail="Login failed")

@router.post("/logout")
async def logout(response: Response, credentials: Optional[HTTPAuthorizationCredentials] = Depends(security), request: Request = None):
    """Logout user by deleting session"""
    try:
        # Try to get token from cookie first, then header
        token = None
        if request and "session_token" in request.cookies:
            token = request.cookies.get("session_token")
        elif credentials:
            token = credentials.credentials
            
        if not token:
            raise HTTPException(status_code=401, detail="No token provided")
        
        success = auth_service.logout_user(token)
        
        # Always clear the cookie regardless of success
        response.delete_cookie(key="session_token", path="/")
        
        if not success:
            raise HTTPException(status_code=400, detail="Logout failed")
        
        return {"message": "Logged out successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Logout endpoint error: {e}")
        raise HTTPException(status_code=500, detail="Logout failed")

@router.get("/me", response_model=User)
async def get_me(request: Request, credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    """Get current user information"""
    try:
        # Try to get token from cookie first, then header
        token = None
        if "session_token" in request.cookies:
            token = request.cookies.get("session_token")
        elif credentials:
            token = credentials.credentials
            
        if not token:
            raise HTTPException(status_code=401, detail="No token provided")
        
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
async def verify_token(request: Request, credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    """Verify if token is valid"""
    try:
        # Try to get token from cookie first, then header
        token = None
        if "session_token" in request.cookies:
            token = request.cookies.get("session_token")
        elif credentials:
            token = credentials.credentials
            
        if not token:
            return {"valid": False, "message": "No token provided"}
        
        user = auth_service.get_current_user(token)
        
        if user:
            return {
                "valid": True, 
                "user_id": user.id, 
                "email": user.email,
                "is_admin": user.is_admin
            }
        else:
            return {"valid": False, "message": "Invalid or expired token"}
        
    except Exception as e:
        logger.error(f"Token verification error: {e}")
        return {"valid": False, "message": "Verification failed"}

async def get_authenticated_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> User:
    """Dependency to get authenticated user for protected routes."""
    # Try to get token from cookie first, then header
    token = None
    if "session_token" in request.cookies:
        token = request.cookies.get("session_token")
    elif credentials:
        token = credentials.credentials

    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    user = auth_service.get_current_user(token)
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    return user
@router.post("/groq-key")
async def update_groq_key(
    request: GroqKeyRequest,
    current_user: User = Depends(get_authenticated_user)
):
    """Update current user's Groq API key"""
    success = auth_service.update_groq_key(current_user.id, request.groq_api_key)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update Groq API key")
    return {"message": "Groq API key updated successfully"}

@router.get("/groq-key")
async def get_groq_key(
    current_user: User = Depends(get_authenticated_user)
):
    """Get current user's Groq API key (masked for privacy)"""
    key = auth_service.get_groq_key(current_user.id)
    if not key:
        raise HTTPException(status_code=404, detail="Groq API key not found")
    
    # Mask the key so plaintext is not transmitted or exposed on the client side
    if len(key) > 8:
        masked_key = key[:4] + "•" * (len(key) - 8) + key[-4:]
    else:
        masked_key = "••••••••"
        
    return {"groq_api_key": masked_key}
@router.post("/accept-policy")
async def accept_policy(
    current_user: User = Depends(get_authenticated_user)
):
    """Mark that the current user has accepted the AI usage policy"""
    success = auth_service.accept_policy(current_user.id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to record policy acceptance")
    return {"message": "Policy accepted successfully", "policy_accepted": True}
