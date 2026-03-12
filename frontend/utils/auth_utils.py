"""
Authentication utilities for Streamlit frontend.
"""

import streamlit as st
import requests
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

class AuthManager:
    """Manages authentication state and operations for Streamlit frontend"""
    
    def __init__(self, backend_url: str = "http://localhost:8000"):
        self.backend_url = backend_url
        self.session_key = "auth_session"
        self.user_key = "auth_user"
    
    def is_authenticated(self) -> bool:
        """Check if user is currently authenticated"""
        return self.session_key in st.session_state and st.session_state[self.session_key] is not None
    
    def get_current_user(self) -> Optional[Dict[str, Any]]:
        """Get current authenticated user"""
        if self.is_authenticated():
            return st.session_state.get(self.user_key)
        return None
    
    def get_session_token(self) -> Optional[str]:
        """Get current session token"""
        if self.is_authenticated():
            return st.session_state[self.session_key]
        return None
    
    def login(self, email: str, password: str) -> tuple[bool, str]:
        """Login user with email and password"""
        try:
            response = requests.post(
                f"{self.backend_url}/api/auth/login",
                json={"email": email, "password": password},
                timeout=30  # Increased timeout
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    # Store session token and user info
                    st.session_state[self.session_key] = data["session_token"]
                    st.session_state[self.user_key] = data["user"]
                    
                    logger.info(f"User logged in: {email}")
                    return True, "Login successful"
                else:
                    return False, data.get("error_message", "Login failed")
            else:
                error_data = response.json() if response.content else {"detail": "Login failed"}
                return False, error_data.get("detail", "Login failed")
                
        except requests.exceptions.ConnectionError as e:
            logger.error(f"Connection error during login: {e}")
            return False, "Cannot connect to server. Please ensure the backend is running on http://localhost:8000"
        except requests.exceptions.Timeout as e:
            logger.error(f"Login timeout: {e}")
            return False, "Login request timed out. Please try again."
        except requests.exceptions.RequestException as e:
            logger.error(f"Login request error: {e}")
            return False, "Network error. Please check your connection and try again."
        except Exception as e:
            logger.error(f"Login error: {e}")
            return False, "An unexpected error occurred"
    
    def register(self, email: str, password: str, confirm_password: str) -> tuple[bool, str]:
        """Register new user account"""
        try:
            response = requests.post(
                f"{self.backend_url}/api/auth/register",
                json={
                    "email": email,
                    "password": password,
                    "confirm_password": confirm_password
                },
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    # Store session token and user info
                    st.session_state[self.session_key] = data["session_token"]
                    st.session_state[self.user_key] = data["user"]
                    
                    logger.info(f"User registered: {email}")
                    return True, "Registration successful"
                else:
                    return False, data.get("error_message", "Registration failed")
            else:
                error_data = response.json()
                return False, error_data.get("detail", "Registration failed")
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Registration request error: {e}")
            return False, "Connection error. Please check if the backend is running."
        except Exception as e:
            logger.error(f"Registration error: {e}")
            return False, "An unexpected error occurred"
    
    def logout(self) -> bool:
        """Logout current user"""
        try:
            token = self.get_session_token()
            if token:
                # Call backend logout endpoint
                response = requests.post(
                    f"{self.backend_url}/api/auth/logout",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=5
                )
                
                # Clear session state regardless of backend response
                if self.session_key in st.session_state:
                    del st.session_state[self.session_key]
                if self.user_key in st.session_state:
                    del st.session_state[self.user_key]
                
                logger.info("User logged out")
                return True
            
        except Exception as e:
            logger.error(f"Logout error: {e}")
            # Still clear local session even if backend call fails
            if self.session_key in st.session_state:
                del st.session_state[self.session_key]
            if self.user_key in st.session_state:
                del st.session_state[self.user_key]
        
        return True
    
    def verify_token(self) -> bool:
        """Verify current session token with backend"""
        try:
            token = self.get_session_token()
            if not token:
                return False
            
            response = requests.post(
                f"{self.backend_url}/api/auth/verify",
                headers={"Authorization": f"Bearer {token}"},
                timeout=15  # Increased timeout
            )
            
            if response.status_code == 200:
                data = response.json()
                is_valid = data.get("valid", False)
                
                # If token is valid, update user info in case it changed
                if is_valid and "user_id" in data and "email" in data:
                    current_user = self.get_current_user()
                    if current_user:
                        current_user.update({
                            "id": data["user_id"],
                            "email": data["email"],
                            "is_admin": data.get("is_admin", False)
                        })
                        st.session_state[self.user_key] = current_user
                
                return is_valid
            
            return False
            
        except requests.exceptions.ConnectionError as e:
            logger.error(f"Connection error during token verification: {e}")
            return False
        except requests.exceptions.Timeout as e:
            logger.error(f"Token verification timeout: {e}")
            return False
        except Exception as e:
            logger.error(f"Token verification error: {e}")
            return False
    
    def get_auth_headers(self) -> Dict[str, str]:
        """Get authentication headers for API requests"""
        token = self.get_session_token()
        if token:
            return {"Authorization": f"Bearer {token}"}
        return {}
    
    def clear_session(self):
        """Clear all authentication session data"""
        if self.session_key in st.session_state:
            del st.session_state[self.session_key]
        if self.user_key in st.session_state:
            del st.session_state[self.user_key]
    
    def recover_session(self) -> bool:
        """Try to recover session after connection issues"""
        try:
            # Wait a moment and try to verify token again
            import time
            time.sleep(2)
            
            if self.verify_token():
                logger.info("Session recovered successfully")
                return True
            else:
                logger.info("Session recovery failed - clearing session")
                self.clear_session()
                return False
                
        except Exception as e:
            logger.error(f"Session recovery error: {e}")
            self.clear_session()
            return False

# Global instance
auth_manager = AuthManager()