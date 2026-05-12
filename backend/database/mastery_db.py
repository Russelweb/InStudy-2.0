"""
Mastery database operations using SQLite.
Tracks user understanding of specific concepts across different study materials.
"""

import sqlite3
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
import logging
import sys
import math
sys.path.append(str(Path(__file__).parent.parent))
from utils.concept_utils import normalize_concept

logger = logging.getLogger(__name__)

# Forgetting curve constants (based on Ebbinghaus)
FORGETTING_CURVE_FACTOR = 0.5  # How much retention drops
FORGETTING_CURVE_DAYS = 7      # Days until significant forgetting
REVIEW_THRESHOLD_DAYS = 14     # Days before concept needs review

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
                    familiarity_score REAL DEFAULT 0, -- Changed to REAL for continuous scores
                    interaction_count INTEGER DEFAULT 1,
                    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    confidence_score REAL DEFAULT 0, -- New: confidence based on interactions
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
                    result REAL NOT NULL, -- The familiarity chosen or correct/incorrect
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Create indexes for performance
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_mastery_user_course 
                ON user_concept_mastery(user_id, course_id)
            """)
            
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_mastery_score 
                ON user_concept_mastery(familiarity_score)
            """)
            
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_mastery_last_updated 
                ON user_concept_mastery(last_updated)
            """)
            
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_logs_user_course 
                ON mastery_logs(user_id, course_id)
            """)
            
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_logs_timestamp 
                ON mastery_logs(timestamp)
            """)
            
            conn.commit()
            logger.info("Mastery database initialized successfully with indexes")

    def update_mastery(self, user_id: str, course_id: str, concept_id: str, familiarity: int, action: str = 'manual_feedback'):
        """
        Update or create a mastery record for a concept.
        
        Args:
            user_id: User identifier
            course_id: Course identifier
            concept_id: Raw concept string (will be normalized)
            familiarity: Familiarity score adjustment (-1 to 1, or fractional)
            action: Type of action (e.g., 'manual_feedback', 'quiz_answer', 'flashcard_review')
        
        Returns:
            True if successful, False otherwise
        """
        # Normalize the concept
        normalized_concept = normalize_concept(concept_id)
        if not normalized_concept:
            logger.warning(f"Invalid concept rejected: '{concept_id}'")
            return False
        
        try:
            with sqlite3.connect(self.db_path) as conn:
                # Get current score if exists
                cursor = conn.execute("""
                    SELECT familiarity_score, interaction_count, last_updated
                    FROM user_concept_mastery
                    WHERE user_id = ? AND course_id = ? AND concept_id = ?
                """, (user_id, course_id, normalized_concept))
                
                existing = cursor.fetchone()
                
                if existing:
                    current_score, interaction_count, last_updated = existing
                    
                    # Apply time decay (forgetting curve)
                    days_since_update = (datetime.now() - datetime.fromisoformat(last_updated)).days
                    decayed_score = self._apply_forgetting_curve(current_score, days_since_update)
                    
                    # INCREASED WEIGHT: Explicit user feedback should have more impact
                    # If user says they mastered it (familiarity=1), we give it high priority
                    if familiarity >= 1:
                        # Jump to at least 0.8 if they say they've mastered it
                        new_score = max(decayed_score, 0.8)
                        # Blend the rest to allow for some progression
                        new_score = new_score * 0.5 + familiarity * 0.5
                    elif familiarity <= -1:
                        # If they say they are totally unfamiliar, drop it significantly
                        new_score = min(decayed_score, -0.2)
                        new_score = new_score * 0.5 + familiarity * 0.5
                    else:
                        # Normal incremental update for subtle familiarity changes
                        weight = min(0.5, 2.0 / (interaction_count + 2)) 
                        new_score = decayed_score * (1 - weight) + familiarity * weight
                    
                    # Clamp to [-1, 1]
                    new_score = max(-1, min(1, new_score))
                    
                    # Calculate confidence score (0-1 based on interaction count and recency)
                    confidence = self._calculate_confidence(interaction_count + 1, days_since_update)
                else:
                    # First interaction
                    if familiarity >= 1:
                        new_score = 0.9  # Start high if they say they know it
                    elif familiarity <= -1:
                        new_score = -0.9 # Start low if they say they don't
                    else:
                        new_score = max(-1, min(1, familiarity))
                    confidence = 0.2
                
                # Update existing or insert new
                conn.execute("""
                    INSERT INTO user_concept_mastery (user_id, course_id, concept_id, familiarity_score, confidence_score, last_updated)
                    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(user_id, course_id, concept_id) DO UPDATE SET
                        familiarity_score = ?,
                        confidence_score = ?,
                        interaction_count = interaction_count + 1,
                        last_updated = CURRENT_TIMESTAMP
                """, (user_id, course_id, normalized_concept, new_score, confidence, new_score, confidence))
                
                # Log the action
                conn.execute("""
                    INSERT INTO mastery_logs (user_id, course_id, concept_id, action, result)
                    VALUES (?, ?, ?, ?, ?)
                """, (user_id, course_id, normalized_concept, action, familiarity))
                
                conn.commit()
                logger.info(f"Mastery updated: '{concept_id}' -> '{normalized_concept}' (score: {new_score:.2f}, confidence: {confidence:.2f})")
                return True
        except Exception as e:
            logger.error(f"Error updating mastery: {e}")
            return False
    
    def _apply_forgetting_curve(self, score: float, days_elapsed: int) -> float:
        """
        Apply Ebbinghaus forgetting curve to a mastery score.
        
        Formula: R(t) = R(0) * e^(-t/S)
        Where:
        - R(t) = retention at time t
        - R(0) = initial retention
        - t = time elapsed
        - S = strength of memory (related to mastery level)
        
        Args:
            score: Current mastery score (-1 to 1)
            days_elapsed: Days since last interaction
            
        Returns:
            Decayed score
        """
        if days_elapsed <= 0:
            return score
        
        # Convert score to retention percentage (0-1)
        retention = (score + 1) / 2
        
        # Memory strength increases with higher mastery
        # Well-mastered concepts decay slower
        strength = FORGETTING_CURVE_DAYS * (1 + retention)
        
        # Apply exponential decay
        decay_factor = math.exp(-days_elapsed / strength)
        new_retention = retention * decay_factor
        
        # Convert back to score (-1 to 1)
        decayed_score = (new_retention * 2) - 1
        
        # Don't let it drop below a minimum threshold
        # (some knowledge persists even after long periods)
        min_score = max(-0.8, score - 0.5)
        decayed_score = max(min_score, decayed_score)
        
        if days_elapsed > 7:
            logger.debug(f"Applied forgetting curve: {score:.2f} -> {decayed_score:.2f} ({days_elapsed} days)")
        
        return decayed_score
    
    def _calculate_confidence(self, interaction_count: int, days_since_update: int) -> float:
        """
        Calculate confidence score based on interaction count and recency.
        
        Args:
            interaction_count: Number of times concept has been reviewed
            days_since_update: Days since last interaction
            
        Returns:
            Confidence score (0-1)
        """
        # Base confidence from interaction count (logarithmic growth)
        # More interactions = higher confidence, but with diminishing returns
        count_confidence = min(1.0, math.log(interaction_count + 1) / math.log(20))
        
        # Recency factor (confidence decreases with time)
        recency_factor = math.exp(-days_since_update / 30)  # 30-day half-life
        
        # Combined confidence
        confidence = count_confidence * (0.7 + 0.3 * recency_factor)
        
        return round(confidence, 2)

    def get_user_mastery(self, user_id: str, course_id: str) -> List[Dict[str, Any]]:
        """Retrieve all mastery records for a user in a specific course"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.execute("""
                    SELECT concept_id, familiarity_score, interaction_count, last_updated
                    FROM user_concept_mastery
                    WHERE user_id = ? AND course_id = ?
                    ORDER BY last_updated DESC
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
    
    def get_mastery_history(self, user_id: str, course_id: str, days: int = 30) -> List[Dict[str, Any]]:
        """
        Get historical mastery data for charting.
        
        Args:
            user_id: User identifier
            course_id: Course identifier
            days: Number of days to look back
            
        Returns:
            List of dictionaries with date and average mastery score
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                
                # Get daily average mastery from logs
                cursor = conn.execute("""
                    SELECT 
                        DATE(timestamp) as date,
                        AVG(CASE 
                            WHEN result = -1 THEN 0
                            WHEN result = 0 THEN 50
                            WHEN result = 1 THEN 100
                            ELSE (result + 1) * 50
                        END) as avg_mastery,
                        COUNT(*) as interaction_count
                    FROM mastery_logs
                    WHERE user_id = ? 
                        AND course_id = ?
                        AND timestamp >= datetime('now', '-' || ? || ' days')
                    GROUP BY DATE(timestamp)
                    ORDER BY date ASC
                """, (user_id, course_id, days))
                
                results = [dict(row) for row in cursor.fetchall()]
                
                # If no historical data, return current state
                if not results:
                    cursor = conn.execute("""
                        SELECT AVG((familiarity_score + 1) * 50) as avg_mastery
                        FROM user_concept_mastery
                        WHERE user_id = ? AND course_id = ?
                    """, (user_id, course_id))
                    
                    current = cursor.fetchone()
                    if current and current['avg_mastery']:
                        return [{
                            'date': datetime.now().strftime('%Y-%m-%d'),
                            'avg_mastery': round(current['avg_mastery'], 1),
                            'interaction_count': 0
                        }]
                
                return results
        except Exception as e:
            logger.error(f"Error getting mastery history: {e}")
            return []
    
    def get_concept_stats(self, user_id: str, course_id: str) -> Dict[str, Any]:
        """
        Get aggregate statistics about user's mastery.
        
        Returns:
            Dictionary with stats like total concepts, mastered count, etc.
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                
                cursor = conn.execute("""
                    SELECT 
                        COUNT(*) as total_concepts,
                        SUM(CASE WHEN familiarity_score > 0.5 THEN 1 ELSE 0 END) as mastered_count,
                        SUM(CASE WHEN familiarity_score BETWEEN -0.5 AND 0.5 THEN 1 ELSE 0 END) as familiar_count,
                        SUM(CASE WHEN familiarity_score < -0.5 THEN 1 ELSE 0 END) as unfamiliar_count,
                        AVG((familiarity_score + 1) * 50) as avg_mastery,
                        AVG(confidence_score) as avg_confidence,
                        SUM(interaction_count) as total_interactions
                    FROM user_concept_mastery
                    WHERE user_id = ? AND course_id = ?
                """, (user_id, course_id))
                
                result = cursor.fetchone()
                return dict(result) if result else {}
        except Exception as e:
            logger.error(f"Error getting concept stats: {e}")
            return {}
    
    def get_stale_concepts(self, user_id: str, course_id: str, days_threshold: int = REVIEW_THRESHOLD_DAYS) -> List[Dict[str, Any]]:
        """
        Get concepts that haven't been reviewed recently and need attention.
        
        Args:
            user_id: User identifier
            course_id: Course identifier
            days_threshold: Number of days to consider a concept stale
            
        Returns:
            List of stale concepts with their details
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                
                cursor = conn.execute("""
                    SELECT 
                        concept_id,
                        familiarity_score,
                        confidence_score,
                        interaction_count,
                        last_updated,
                        CAST((julianday('now') - julianday(last_updated)) AS INTEGER) as days_since_update
                    FROM user_concept_mastery
                    WHERE user_id = ? 
                        AND course_id = ?
                        AND julianday('now') - julianday(last_updated) >= ?
                        AND familiarity_score < 0.8
                    ORDER BY 
                        familiarity_score ASC,
                        last_updated ASC
                    LIMIT 20
                """, (user_id, course_id, days_threshold))
                
                results = [dict(row) for row in cursor.fetchall()]
                
                # Apply forgetting curve to show predicted current mastery
                for concept in results:
                    days_elapsed = concept['days_since_update']
                    original_score = concept['familiarity_score']
                    predicted_score = self._apply_forgetting_curve(original_score, days_elapsed)
                    concept['predicted_current_score'] = round(predicted_score, 2)
                    concept['decay_amount'] = round(original_score - predicted_score, 2)
                
                return results
        except Exception as e:
            logger.error(f"Error getting stale concepts: {e}")
            return []
    
    def get_review_schedule(self, user_id: str, course_id: str) -> Dict[str, List[str]]:
        """
        Generate a review schedule based on forgetting curve and mastery levels.
        
        Returns:
            Dictionary with review priorities: 'urgent', 'soon', 'later'
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                
                cursor = conn.execute("""
                    SELECT 
                        concept_id,
                        familiarity_score,
                        last_updated,
                        CAST((julianday('now') - julianday(last_updated)) AS INTEGER) as days_since_update
                    FROM user_concept_mastery
                    WHERE user_id = ? AND course_id = ?
                """, (user_id, course_id))
                
                concepts = [dict(row) for row in cursor.fetchall()]
                
                schedule = {
                    'urgent': [],      # Review today
                    'soon': [],        # Review within 3 days
                    'later': [],       # Review within a week
                    'maintained': []   # No review needed
                }
                
                for concept in concepts:
                    days_elapsed = concept['days_since_update']
                    score = concept['familiarity_score']
                    predicted_score = self._apply_forgetting_curve(score, days_elapsed)
                    
                    # Categorize based on predicted score and time
                    if predicted_score < -0.3 or days_elapsed > 21:
                        schedule['urgent'].append(concept['concept_id'])
                    elif predicted_score < 0.2 or days_elapsed > 14:
                        schedule['soon'].append(concept['concept_id'])
                    elif predicted_score < 0.6 or days_elapsed > 7:
                        schedule['later'].append(concept['concept_id'])
                    else:
                        schedule['maintained'].append(concept['concept_id'])
                
                return schedule
        except Exception as e:
            logger.error(f"Error generating review schedule: {e}")
            return {'urgent': [], 'soon': [], 'later': [], 'maintained': []}
    
    def apply_decay_to_all_concepts(self, user_id: str, course_id: str) -> int:
        """
        Apply forgetting curve decay to all concepts for a user/course.
        This should be run periodically (e.g., daily) to keep mastery scores current.
        
        Returns:
            Number of concepts updated
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                # Get all concepts
                cursor = conn.execute("""
                    SELECT concept_id, familiarity_score, last_updated
                    FROM user_concept_mastery
                    WHERE user_id = ? AND course_id = ?
                """, (user_id, course_id))
                
                concepts = cursor.fetchall()
                updated_count = 0
                
                for concept_id, score, last_updated in concepts:
                    days_elapsed = (datetime.now() - datetime.fromisoformat(last_updated)).days
                    
                    if days_elapsed > 0:
                        decayed_score = self._apply_forgetting_curve(score, days_elapsed)
                        
                        # Only update if decay is significant (> 0.05)
                        if abs(score - decayed_score) > 0.05:
                            conn.execute("""
                                UPDATE user_concept_mastery
                                SET familiarity_score = ?
                                WHERE user_id = ? AND course_id = ? AND concept_id = ?
                            """, (decayed_score, user_id, course_id, concept_id))
                            updated_count += 1
                
                conn.commit()
                logger.info(f"Applied decay to {updated_count} concepts for user {user_id}, course {course_id}")
                return updated_count
        except Exception as e:
            logger.error(f"Error applying decay: {e}")
            return 0

    def clear_mastery(self, user_id: str, course_id: str) -> bool:
        """
        Completely reset all mastery data for a user in a specific course.
        Deletes records from both user_concept_mastery and mastery_logs.
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                # Delete mastery records
                conn.execute("""
                    DELETE FROM user_concept_mastery 
                    WHERE user_id = ? AND course_id = ?
                """, (user_id, course_id))
                
                # Delete interaction logs
                conn.execute("""
                    DELETE FROM mastery_logs 
                    WHERE user_id = ? AND course_id = ?
                """, (user_id, course_id))
                
                conn.commit()
                logger.info(f"Mastery data reset for user {user_id}, course {course_id}")
                return True
        except Exception as e:
            logger.error(f"Error resetting mastery data: {e}")
            return False

# Global instance
mastery_db = MasteryDatabase()
