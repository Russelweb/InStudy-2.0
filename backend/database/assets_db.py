"""
Saved Assets database operations using SQLite.
Tracks user-saved flashcard decks, quizzes, summaries, and study plans.
"""

import sqlite3
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any, List
import json
import logging

logger = logging.getLogger(__name__)

class AssetsDatabase:
    def __init__(self, db_path: str = "backend/assets.db"):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(exist_ok=True)
        self.init_database()
    
    def init_database(self):
        """Initialize the assets database with required tables"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS saved_assets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    course_id TEXT NOT NULL,
                    asset_type TEXT NOT NULL,
                    title TEXT NOT NULL,
                    data TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    metadata TEXT
                )
            """)
            
            # Index for faster queries
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_user_assets 
                ON saved_assets(user_id, asset_type)
            """)
            
            conn.commit()
            logger.info("Assets database initialized successfully")
    
    def save_asset(self, user_id: str, course_id: str, asset_type: str, 
                   title: str, data: Dict[str, Any], metadata: Optional[Dict[str, Any]] = None) -> int:
        """Save a new asset or update existing one"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("""
                    INSERT INTO saved_assets 
                    (user_id, course_id, asset_type, title, data, metadata, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """, (
                    user_id,
                    course_id,
                    asset_type,
                    title,
                    json.dumps(data),
                    json.dumps(metadata) if metadata else None
                ))
                conn.commit()
                return cursor.lastrowid
        except Exception as e:
            logger.error(f"Error saving asset: {e}")
            raise
    
    def get_asset(self, asset_id: int, user_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific asset by ID (with user verification)"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.execute("""
                    SELECT * FROM saved_assets 
                    WHERE id = ? AND user_id = ?
                """, (asset_id, user_id))
                
                row = cursor.fetchone()
                if row:
                    return {
                        "id": row["id"],
                        "user_id": row["user_id"],
                        "course_id": row["course_id"],
                        "asset_type": row["asset_type"],
                        "title": row["title"],
                        "data": json.loads(row["data"]),
                        "created_at": row["created_at"],
                        "updated_at": row["updated_at"],
                        "metadata": json.loads(row["metadata"]) if row["metadata"] else None
                    }
                return None
        except Exception as e:
            logger.error(f"Error getting asset: {e}")
            return None
    
    def list_assets(self, user_id: str, asset_type: Optional[str] = None, 
                    course_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """List all assets for a user, optionally filtered by type and course"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                
                query = "SELECT * FROM saved_assets WHERE user_id = ?"
                params = [user_id]
                
                if asset_type:
                    query += " AND asset_type = ?"
                    params.append(asset_type)
                
                if course_id:
                    query += " AND course_id = ?"
                    params.append(course_id)
                
                query += " ORDER BY updated_at DESC"
                
                cursor = conn.execute(query, params)
                
                assets = []
                for row in cursor.fetchall():
                    assets.append({
                        "id": row["id"],
                        "user_id": row["user_id"],
                        "course_id": row["course_id"],
                        "asset_type": row["asset_type"],
                        "title": row["title"],
                        "data": json.loads(row["data"]),
                        "created_at": row["created_at"],
                        "updated_at": row["updated_at"],
                        "metadata": json.loads(row["metadata"]) if row["metadata"] else None
                    })
                
                return assets
        except Exception as e:
            logger.error(f"Error listing assets: {e}")
            return []
    
    def update_asset(self, asset_id: int, user_id: str, title: Optional[str] = None,
                     data: Optional[Dict[str, Any]] = None, 
                     metadata: Optional[Dict[str, Any]] = None) -> bool:
        """Update an existing asset"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                updates = []
                params = []
                
                if title:
                    updates.append("title = ?")
                    params.append(title)
                
                if data:
                    updates.append("data = ?")
                    params.append(json.dumps(data))
                
                if metadata:
                    updates.append("metadata = ?")
                    params.append(json.dumps(metadata))
                
                if not updates:
                    return False
                
                updates.append("updated_at = CURRENT_TIMESTAMP")
                params.extend([asset_id, user_id])
                
                query = f"UPDATE saved_assets SET {', '.join(updates)} WHERE id = ? AND user_id = ?"
                conn.execute(query, params)
                conn.commit()
                return True
        except Exception as e:
            logger.error(f"Error updating asset: {e}")
            return False
    
    def delete_asset(self, asset_id: int, user_id: str) -> bool:
        """Delete an asset"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    DELETE FROM saved_assets 
                    WHERE id = ? AND user_id = ?
                """, (asset_id, user_id))
                conn.commit()
                return True
        except Exception as e:
            logger.error(f"Error deleting asset: {e}")
            return False
    
    def get_stats(self, user_id: str) -> Dict[str, int]:
        """Get asset statistics for a user"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("""
                    SELECT asset_type, COUNT(*) as count
                    FROM saved_assets
                    WHERE user_id = ?
                    GROUP BY asset_type
                """, (user_id,))
                
                stats = {}
                for row in cursor.fetchall():
                    stats[row[0]] = row[1]
                
                return stats
        except Exception as e:
            logger.error(f"Error getting stats: {e}")
            return {}

# Global instance
assets_db = AssetsDatabase()
