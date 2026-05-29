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
import base64
from cryptography.fernet import Fernet
from config import settings

logger = logging.getLogger(__name__)

class AuthDatabase:
    def __init__(self, db_path: str = "backend/users.db"):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(exist_ok=True)
        # Derive a valid 32-byte Fernet key from the config string
        raw = settings.ENCRYPTION_KEY.encode()
        # Pad/truncate to exactly 32 bytes, then base64-encode → valid Fernet key
        raw = (raw * ((32 // len(raw)) + 1))[:32]
        self.fernet = Fernet(base64.urlsafe_b64encode(raw))
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
                    groq_api_key TEXT,
                    preferred_language TEXT DEFAULT 'en',
                    policy_accepted INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_login TIMESTAMP
                )
            """)
            
            # Check if groq_api_key column exists (for existing databases)
            cursor = conn.execute("PRAGMA table_info(users)")
            columns = [column[1] for column in cursor.fetchall()]
            if 'groq_api_key' not in columns:
                conn.execute("ALTER TABLE users ADD COLUMN groq_api_key TEXT")
                logger.info("Added groq_api_key column to users table")
            
            if 'preferred_language' not in columns:
                conn.execute("ALTER TABLE users ADD COLUMN preferred_language TEXT DEFAULT 'en'")
                logger.info("Added preferred_language column to users table")
            
            conn.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    token TEXT PRIMARY KEY,
                    user_id INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            """)

            self._bootstrap_admin_if_needed(conn)
            
            conn.commit()
            logger.info("Database initialized successfully")

    def _bootstrap_admin_if_needed(self, conn: sqlite3.Connection) -> None:
        """Create the first admin only from explicit environment settings."""
        cursor = conn.execute("SELECT COUNT(*) FROM users WHERE is_admin = 1")
        if cursor.fetchone()[0] > 0:
            return

        email = settings.BOOTSTRAP_ADMIN_EMAIL
        password = settings.BOOTSTRAP_ADMIN_PASSWORD
        if not email or not password:
            logger.warning("No admin account exists. Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD to create one.")
            return

        admin_password_hash = self._hash_password(password)
        conn.execute(
            """
            INSERT INTO users (email, password_hash, is_admin)
            VALUES (?, ?, 1)
            ON CONFLICT(email) DO UPDATE SET is_admin = 1
            """,
            (email.lower().strip(), admin_password_hash)
        )
        logger.info("Bootstrap admin account created from environment settings.")
    
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
    
    def create_session(self, user_id: int, expires_days: int = 90) -> str:
        """Create a new session token and invalidate all previous sessions for this user"""
        try:
            # First, delete all existing sessions for this user (enforce single session)
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
                conn.commit()
                logger.info(f"Invalidated all previous sessions for user {user_id}")
            
            # Now create new session with longer duration (90 days)
            token = secrets.token_urlsafe(32)
            expires_at = datetime.now() + timedelta(days=expires_days)
            
            with sqlite3.connect(self.db_path) as conn:
                conn.execute(
                    "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
                    (token, user_id, expires_at)
                )
                conn.commit()
                
                logger.info(f"New session created for user {user_id} (expires: {expires_at})")
                return token
                
        except Exception as e:
            logger.error(f"Error creating session: {e}")
            return None
    
    def verify_session(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify session token and return user info"""
        try:
            # Use check_same_thread=False and timeout for concurrent access
            with sqlite3.connect(self.db_path, timeout=10.0, check_same_thread=False) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.execute("""
                    SELECT s.user_id, s.expires_at, u.email, u.is_admin
                    FROM sessions s 
                    JOIN users u ON s.user_id = u.id 
                    WHERE s.token = ? AND s.expires_at > CURRENT_TIMESTAMP
                """, (token,))
                
                session = cursor.fetchone()
                
                if session:
                    return {
                        'user_id': session['user_id'],
                        'email': session['email'],
                        'is_admin': bool(session['is_admin'])
                    }
                
                return None
                
        except sqlite3.OperationalError as e:
            logger.error(f"Database locked or operational error verifying session: {e}")
            return None
        except Exception as e:
            logger.error(f"Error verifying session: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return None
    
    def refresh_session(self, token: str) -> bool:
        """Refresh session expiration time"""
        try:
            new_expires_at = datetime.now() + timedelta(days=90)
            
            # Use check_same_thread=False and timeout for concurrent access
            with sqlite3.connect(self.db_path, timeout=10.0, check_same_thread=False) as conn:
                cursor = conn.execute(
                    "UPDATE sessions SET expires_at = ? WHERE token = ? AND expires_at > CURRENT_TIMESTAMP",
                    (new_expires_at, token)
                )
                conn.commit()
                
                if cursor.rowcount > 0:
                    logger.debug(f"Session refreshed: {token[:10]}...")
                    return True
                
                return False
                
        except sqlite3.OperationalError as e:
            logger.error(f"Database locked or operational error refreshing session: {e}")
            return False
        except Exception as e:
            logger.error(f"Error refreshing session: {e}")
            return False
    
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
            # Use check_same_thread=False and timeout for concurrent access
            with sqlite3.connect(self.db_path, timeout=10.0, check_same_thread=False) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.execute(
                    "SELECT id, email, is_admin, (groq_api_key IS NOT NULL) as has_groq_key, policy_accepted, created_at, last_login FROM users WHERE id = ?",
                    (user_id,)
                )
                user = cursor.fetchone()
                
                if user:
                    return dict(user)
                
                return None
                
        except sqlite3.OperationalError as e:
            logger.error(f"Database locked or operational error getting user: {e}")
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

    def update_groq_key(self, user_id: int, key: str) -> bool:
        """Encrypt and store user's Groq API key"""
        try:
            encrypted_key = self.fernet.encrypt(key.encode()).decode()
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute(
                    "UPDATE users SET groq_api_key = ? WHERE id = ?",
                    (encrypted_key, user_id)
                )
                conn.commit()
                return cursor.rowcount > 0
        except Exception as e:
            logger.error(f"Error updating Groq key: {e}")
            return False

    def get_groq_key(self, user_id: int) -> Optional[str]:
        """Fetch and decrypt user's Groq API key"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("SELECT groq_api_key FROM users WHERE id = ?", (user_id,))
                row = cursor.fetchone()
                if row and row[0]:
                    decrypted_key = self.fernet.decrypt(row[0].encode()).decode()
                    return decrypted_key
                return None
        except Exception as e:
            logger.error(f"Error fetching/decrypting Groq key: {e}")
            return None

    def update_preferred_language(self, user_id: int, language: str) -> bool:
        """Update user's preferred language"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute(
                    "UPDATE users SET preferred_language = ? WHERE id = ?",
                    (language, user_id)
                )
                conn.commit()
                return cursor.rowcount > 0
        except Exception as e:
            logger.error(f"Error updating preferred language: {e}")
            return False

    def get_preferred_language(self, user_id: int) -> str:
        """Get user's preferred language, defaults to 'en'"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("SELECT preferred_language FROM users WHERE id = ?", (user_id,))
                row = cursor.fetchone()
                if row and row[0]:
                    return row[0]
                return 'en'
        except Exception as e:
            logger.error(f"Error fetching preferred language: {e}")
            return 'en'

    def accept_policy(self, user_id: int):
        """Mark that a user has accepted the AI usage policy"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "UPDATE users SET policy_accepted = 1 WHERE id = ?",
                    (user_id,)
                )
                conn.commit()
                return True
        except Exception as e:
            logger.error(f"Error accepting policy: {e}")
            return False

    def has_accepted_policy(self, user_id: int):
        """Check if a user has accepted the policy"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT policy_accepted FROM users WHERE id = ?", (user_id,))
                result = cursor.fetchone()
                return bool(result[0]) if result else False
        except Exception as e:
            logger.error(f"Error checking policy status: {e}")
            return False

# Global instance
auth_db = AuthDatabase()
