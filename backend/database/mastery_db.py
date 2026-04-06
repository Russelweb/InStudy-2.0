"""
Mastery database operations using SQLite.
Tracks user understanding of specific concepts across different study materials.
"""

import sqlite3
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any, List
import logging

logger = logging.getLogger(__name__)

class MasteryDatabase:
    def __init__(self, db_path: str = "backend/mastery.db"):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(exist_ok=True)
        self.init_database()
    
    def init_database(self):
        """Initialize the mastery database with required tables"""
        with sqlite3.connect(self.db_path) as conn:
            # Main table for tracking concept mastery
            conn.execute("""
                CREATE TABLE IF NOT EXISTS user_concept_mastery (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    course_id TEXT NOT NULL,
                    concept_id TEXT NOT NULL,
                    familiarity_score INTEGER DEFAULT 0, -- -1: Unfamiliar, 0: Familiar, 1: Mastered
                    interaction_count INTEGER DEFAULT 1,
                    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, course_id, concept_id)
                )
            """)
            
            # Table for logging individual interactions (for forgetting curve calculations later)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS mastery_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    course_id TEXT NOT NULL,
                    concept_id TEXT NOT NULL,
                    action TEXT NOT NULL, -- e.g., 'flashcard_flip', 'quiz_answer'
                    result INTEGER NOT NULL, -- The familiarity chosen or correct/incorrect
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            conn.commit()
            logger.info("Mastery database initialized successfully")

    def update_mastery(self, user_id: str, course_id: str, concept_id: str, familiarity: int):
        """Update or create a mastery record for a concept"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                # Update existing or insert new
                conn.execute("""
                    INSERT INTO user_concept_mastery (user_id, course_id, concept_id, familiarity_score, last_updated)
                    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(user_id, course_id, concept_id) DO UPDATE SET
                        familiarity_score = excluded.familiarity_score,
                        interaction_count = interaction_count + 1,
                        last_updated = CURRENT_TIMESTAMP
                """, (user_id, course_id, concept_id, familiarity))
                
                # Log the action
                conn.execute("""
                    INSERT INTO mastery_logs (user_id, course_id, concept_id, action, result)
                    VALUES (?, ?, ?, 'manual_feedback', ?)
                """, (user_id, course_id, concept_id, familiarity))
                
                conn.commit()
                return True
        except Exception as e:
            logger.error(f"Error updating mastery: {e}")
            return False

    def get_user_mastery(self, user_id: str, course_id: str) -> List[Dict[str, Any]]:
        """Retrieve all mastery records for a user in a specific course"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.execute("""
                    SELECT concept_id, familiarity_score, interaction_count, last_updated
                    FROM user_concept_mastery
                    WHERE user_id = ? AND course_id = ?
                """, (user_id, course_id))
                return [dict(row) for row in cursor.fetchall()]
        except Exception as e:
            logger.error(f"Error retrieving mastery: {e}")
            return []

    def get_priority_concepts(self, user_id: str, course_id: str, limit: int = 10) -> List[str]:
        """Get concepts that need the most attention (weakest or oldest)"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("""
                    SELECT concept_id
                    FROM user_concept_mastery
                    WHERE user_id = ? AND course_id = ?
                    ORDER BY familiarity_score ASC, last_updated ASC
                    LIMIT ?
                """, (user_id, course_id, limit))
                return [row[0] for row in cursor.fetchall()]
        except Exception as e:
            logger.error(f"Error getting priority concepts: {e}")
            return []

# Global instance
mastery_db = MasteryDatabase()
