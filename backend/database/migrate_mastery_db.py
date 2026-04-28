"""
Migration script to update mastery database schema.
Adds confidence_score column and creates indexes.
"""

import sqlite3
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def migrate_mastery_database(db_path: str = "backend/mastery.db"):
    """
    Migrate existing mastery database to new schema.
    Safe to run multiple times (idempotent).
    """
    db_path = Path(db_path)
    
    if not db_path.exists():
        logger.info(f"Database {db_path} doesn't exist yet. Will be created with new schema.")
        return
    
    logger.info(f"Migrating mastery database: {db_path}")
    
    try:
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            
            # Check if confidence_score column exists
            cursor.execute("PRAGMA table_info(user_concept_mastery)")
            columns = [row[1] for row in cursor.fetchall()]
            
            if 'confidence_score' not in columns:
                logger.info("Adding confidence_score column...")
                cursor.execute("""
                    ALTER TABLE user_concept_mastery 
                    ADD COLUMN confidence_score REAL DEFAULT 0.5
                """)
                logger.info("✅ Added confidence_score column")
            else:
                logger.info("✅ confidence_score column already exists")
            
            # Check if familiarity_score is REAL (not INTEGER)
            cursor.execute("PRAGMA table_info(user_concept_mastery)")
            for row in cursor.fetchall():
                if row[1] == 'familiarity_score':
                    col_type = row[2]
                    if col_type == 'INTEGER':
                        logger.warning("⚠️  familiarity_score is INTEGER, should be REAL")
                        logger.warning("    This won't affect functionality but continuous scores are better")
                        logger.warning("    Consider recreating the database for optimal performance")
                    else:
                        logger.info("✅ familiarity_score is REAL")
                    break
            
            # Create indexes if they don't exist
            indexes = [
                ("idx_mastery_user_course", "CREATE INDEX IF NOT EXISTS idx_mastery_user_course ON user_concept_mastery(user_id, course_id)"),
                ("idx_mastery_score", "CREATE INDEX IF NOT EXISTS idx_mastery_score ON user_concept_mastery(familiarity_score)"),
                ("idx_mastery_last_updated", "CREATE INDEX IF NOT EXISTS idx_mastery_last_updated ON user_concept_mastery(last_updated)"),
                ("idx_logs_user_course", "CREATE INDEX IF NOT EXISTS idx_logs_user_course ON mastery_logs(user_id, course_id)"),
                ("idx_logs_timestamp", "CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON mastery_logs(timestamp)"),
            ]
            
            for idx_name, idx_sql in indexes:
                try:
                    cursor.execute(idx_sql)
                    logger.info(f"✅ Created/verified index: {idx_name}")
                except Exception as e:
                    logger.warning(f"⚠️  Could not create index {idx_name}: {e}")
            
            # Initialize confidence scores for existing records
            cursor.execute("""
                UPDATE user_concept_mastery 
                SET confidence_score = CASE 
                    WHEN interaction_count >= 10 THEN 0.8
                    WHEN interaction_count >= 5 THEN 0.6
                    WHEN interaction_count >= 2 THEN 0.4
                    ELSE 0.2
                END
                WHERE confidence_score = 0 OR confidence_score IS NULL
            """)
            updated = cursor.rowcount
            if updated > 0:
                logger.info(f"✅ Initialized confidence scores for {updated} existing concepts")
            
            conn.commit()
            logger.info("✅ Migration completed successfully!")
            
    except Exception as e:
        logger.error(f"❌ Migration failed: {e}")
        raise


def migrate_all_databases():
    """Migrate all mastery databases (main and backend folder)."""
    paths = [
        "backend/mastery.db",
        "mastery.db",
        "backend/backend/mastery.db"
    ]
    
    for path in paths:
        if Path(path).exists():
            logger.info(f"\n{'='*60}")
            logger.info(f"Migrating: {path}")
            logger.info(f"{'='*60}")
            migrate_mastery_database(path)


if __name__ == "__main__":
    print("=" * 60)
    print("Mastery Database Migration Script")
    print("=" * 60)
    print()
    
    migrate_all_databases()
    
    print()
    print("=" * 60)
    print("Migration complete! You can now restart your backend.")
    print("=" * 60)
