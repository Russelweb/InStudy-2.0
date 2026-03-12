"""
Authentication middleware for FastAPI to protect routes and inject user context.
"""

from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Callable
import logging

from services.auth_service import auth_service

logger = logging.getLogger(__name__)

class AuthMiddleware(BaseHTTPMiddleware):
    """Middleware to handle authentication for protected routes"""
    
    def __init__(self, app, protected_paths: list = None):
        super().__init__(app)
        # Define which paths require authentication
        self.protected_paths = protected_paths or [
            "/api/documents",
            "/api/chat",
            "/api/quiz",
            "/api/flashcards",
            "/api/summary",
            "/api/planner",
            "/api/stats"
        ]
        
        # Paths that don't require authentication
        self.public_paths = [
            "/",
            "/health",
            "/docs",
            "/openapi.json",
            "/api/auth"
        ]
    
    async def dispatch(self, request: Request, call_next: Callable):
        """Process request and check authentication if needed"""
        try:
            # Check if path requires authentication
            if self.is_protected_route(request.url.path):
                # Extract token from request
                token = self.extract_token(request)
                
                if not token:
                    return JSONResponse(
                        status_code=401,
                        content={"detail": "Authentication required"}
                    )
                
                # Verify token and get user
                try:
                    user = auth_service.get_current_user(token)
                    
                    if not user:
                        return JSONResponse(
                            status_code=401,
                            content={"detail": "Invalid or expired token"}
                        )
                    
                    # Inject user into request state
                    request.state.user = user
                    request.state.user_id = user.id
                    
                    logger.debug(f"Authenticated request for user {user.id}: {request.url.path}")
                    
                except Exception as auth_error:
                    logger.error(f"Authentication error for path {request.url.path}: {auth_error}")
                    import traceback
                    logger.error(traceback.format_exc())
                    return JSONResponse(
                        status_code=500,
                        content={"detail": f"Authentication error: {str(auth_error)}"}
                    )
            
            # Continue with request
            response = await call_next(request)
            return response
            
        except Exception as e:
            logger.error(f"Auth middleware error: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return JSONResponse(
                status_code=500,
                content={"detail": f"Middleware error: {str(e)}"}
            )
    
    def is_protected_route(self, path: str) -> bool:
        """Check if route requires authentication"""
        # Check public paths first
        for public_path in self.public_paths:
            if path.startswith(public_path):
                return False
        
        # Special handling for quiz evaluation - skip middleware
        if path == "/api/quiz/evaluate" or path == "/api/quiz/test-auth":
            return False
        
        # Check protected paths
        for protected_path in self.protected_paths:
            if path.startswith(protected_path):
                return True
        
        return False
    
    def extract_token(self, request: Request) -> str:
        """Extract authentication token from request"""
        # Try Authorization header first
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            return auth_header[7:]  # Remove "Bearer " prefix
        
        # Try X-Auth-Token header
        token_header = request.headers.get("X-Auth-Token")
        if token_header:
            return token_header
        
        # Try query parameter (for development/testing)
        token_param = request.query_params.get("token")
        if token_param:
            return token_param
        
        return None