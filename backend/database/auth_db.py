"""
Authentication database operations using SQLite.
Handles user registration, login, and session management.
"""

import sqlite3
import hashlib
import secrets
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, Any, List
import logging

logger = logging.getLogger(__name__)

class AuthDatabase:
    def __init__(self, db_path: str = "backend/users.db"):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(exist_ok=True)
        self.init_database()
    
    def init_database(self):
        """Initialize the database with required tables"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    is_admin INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_login TIMESTAMP
                )
            """)
            
            conn.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    token TEXT PRIMARY KEY,
                    user_id INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            """)
            
            # Create default admin account if it doesn't exist
            cursor = conn.execute("SELECT COUNT(*) FROM users WHERE email = ?", ("admin@instudy.com",))
            if cursor.fetchone()[0] == 0:
                admin_password_hash = self._hash_password("admin123")
                conn.execute(
                    "INSERT INTO users (email, password_hash, is_admin) VALUES (?, ?, 1)",
                    ("admin@instudy.com", admin_password_hash)
                )
                logger.info("Default admin account created: admin@instudy.com / admin123")
            
            conn.commit()
            logger.info("Database initialized successfully")
    
    def create_user(self, email: str, password: str) -> Optional[int]:
        """Create a new user account"""
        try:
            password_hash = self._hash_password(password)
            
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute(
                    "INSERT INTO users (email, password_hash) VALUES (?, ?)",
                    (email.lower().strip(), password_hash)
                )
                user_id = cursor.lastrowid
                conn.commit()
                
                logger.info(f"User created successfully: {email}")
                return user_id
                
        except sqlite3.IntegrityError:
            logger.warning(f"User already exists: {email}")
            return None
        except Exception as e:
            logger.error(f"Error creating user: {e}")
            return None
    
    def authenticate_user(self, email: str, password: str) -> Optional[Dict[str, Any]]:
        """Authenticate user credentials"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.execute(
                    "SELECT id, email, password_hash FROM users WHERE email = ?",
                    (email.lower().strip(),)
                )
                user = cursor.fetchone()
                
                if user and self._verify_password(password, user['password_hash']):
                    # Update last login
                    conn.execute(
                        "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?",
                        (user['id'],)
                    )
                    conn.commit()
                    
                    logger.info(f"User authenticated successfully: {email}")
                    return {
                        'id': user['id'],
                        'email': user['email']
                    }
                
                logger.warning(f"Authentication failed for: {email}")
                return None
                
        except Exception as e:
            logger.error(f"Error authenticating user: {e}")
            return None
    
    def create_session(self, user_id: int, expires_days: int = 30) -> str:
        """Create a new session token and invalidate all previous sessions for this user"""
        try:
            # First, delete all existing sessions for this user (enforce single session)
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
                conn.commit()
                logger.info(f"Invalidated all previous sessions for user {user_id}")
            
            # Now create new session
            token = secrets.token_urlsafe(32)
            expires_at = datetime.now() + timedelta(days=expires_days)
            
            with sqlite3.connect(self.db_path) as conn:
                conn.execute(
                    "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
                    (token, user_id, expires_at)
                )
                conn.commit()
                
                logger.info(f"New session created for user {user_id}")
                return token
                
        except Exception as e:
            logger.error(f"Error creating session: {e}")
            return None
    
    def verify_session(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify session token and return user info"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.execute("""
                    SELECT s.user_id, s.expires_at, u.email 
                    FROM sessions s 
                    JOIN users u ON s.user_id = u.id 
                    WHERE s.token = ? AND s.expires_at > CURRENT_TIMESTAMP
                """, (token,))
                
                session = cursor.fetchone()
                
                if session:
                    return {
                        'user_id': session['user_id'],
                        'email': session['email']
                    }
                
                return None
                
        except Exception as e:
            logger.error(f"Error verifying session: {e}")
            return None
    
    def delete_session(self, token: str) -> bool:
        """Delete a session (logout)"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
                conn.commit()
                
                if cursor.rowcount > 0:
                    logger.info("Session deleted successfully")
                    return True
                
                return False
                
        except Exception as e:
            logger.error(f"Error deleting session: {e}")
            return False
    
    def cleanup_expired_sessions(self):
        """Remove expired sessions"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP")
                conn.commit()
                
                if cursor.rowcount > 0:
                    logger.info(f"Cleaned up {cursor.rowcount} expired sessions")
                
        except Exception as e:
            logger.error(f"Error cleaning up sessions: {e}")
    
    def get_user_by_id(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Get user information by ID"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.execute(
                    "SELECT id, email, is_admin, created_at, last_login FROM users WHERE id = ?",
                    (user_id,)
                )
                user = cursor.fetchone()
                
                if user:
                    return dict(user)
                
                return None
                
        except Exception as e:
            logger.error(f"Error getting user: {e}")
            return None
    
    def get_all_users(self) -> List[Dict[str, Any]]:
        """Get all users (admin only)"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.execute(
                    "SELECT id, email, is_admin, created_at, last_login FROM users ORDER BY created_at DESC"
                )
                users = cursor.fetchall()
                
                return [dict(user) for user in users]
                
        except Exception as e:
            logger.error(f"Error getting all users: {e}")
            return []
    
    def delete_user(self, user_id: int) -> bool:
        """Delete a user and all their sessions"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                # Delete user's sessions first
                conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
                
                # Delete user
                cursor = conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
                conn.commit()
                
                if cursor.rowcount > 0:
                    logger.info(f"User {user_id} deleted successfully")
                    return True
                
                return False
                
        except Exception as e:
            logger.error(f"Error deleting user: {e}")
            return False
    
    def make_admin(self, user_id: int) -> bool:
        """Make a user an admin"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute(
                    "UPDATE users SET is_admin = 1 WHERE id = ?",
                    (user_id,)
                )
                conn.commit()
                
                if cursor.rowcount > 0:
                    logger.info(f"User {user_id} is now an admin")
                    return True
                
                return False
                
        except Exception as e:
            logger.error(f"Error making user admin: {e}")
            return False
    
    def revoke_admin(self, user_id: int) -> bool:
        """Revoke admin privileges from a user"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute(
                    "UPDATE users SET is_admin = 0 WHERE id = ?",
                    (user_id,)
                )
                conn.commit()
                
                if cursor.rowcount > 0:
                    logger.info(f"Admin privileges revoked from user {user_id}")
                    return True
                
                return False
                
        except Exception as e:
            logger.error(f"Error revoking admin: {e}")
            return False
    
    def _hash_password(self, password: str) -> str:
        """Hash password using bcrypt-like approach with salt"""
        # Generate a random salt
        salt = secrets.token_hex(16)
        
        # Hash password with salt using SHA-256 (simplified for local use)
        password_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
        
        # Return salt + hash
        return salt + password_hash.hex()
    
    def _verify_password(self, password: str, stored_hash: str) -> bool:
        """Verify password against stored hash"""
        try:
            # Extract salt (first 32 characters) and hash
            salt = stored_hash[:32]
            stored_password_hash = stored_hash[32:]
            
            # Hash the provided password with the same salt
            password_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
            
            # Compare hashes
            return password_hash.hex() == stored_password_hash
            
        except Exception as e:
            logger.error(f"Error verifying password: {e}")
            return False

# Global instance
auth_db = AuthDatabase()