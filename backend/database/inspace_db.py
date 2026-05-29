"""
InSpace Database schema & operations using SQLite.
Stores interactive concept canvases, node arrangements, detailed topic content, and mastery logs.
"""

import sqlite3
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any, List
import logging
import json

logger = logging.getLogger(__name__)

class InSpaceDatabase:
    def __init__(self, db_path: str = "backend/inspace.db"):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(exist_ok=True)
        self.init_database()
        
    def init_database(self):
        """Initialize the InSpace database with necessary tables"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                # 1. Canvases table (Stores workspaces)
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS canvases (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        topic TEXT NOT NULL,
                        document_id TEXT, -- Nullable for standalone mode
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
                # 2. Concept Nodes table
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS canvas_nodes (
                        id TEXT NOT NULL,
                        canvas_id TEXT NOT NULL,
                        label TEXT NOT NULL,
                        x REAL DEFAULT 0,
                        y REAL DEFAULT 0,
                        difficulty TEXT DEFAULT 'Beginner', -- Beginner, Intermediate, Advanced
                        mastery REAL DEFAULT 0.0, -- 0.0 to 1.0
                        confidence REAL DEFAULT 0.0, -- 0.0 to 1.0
                        attempts INTEGER DEFAULT 0,
                        time_spent INTEGER DEFAULT 0, -- in seconds
                        explanation TEXT,
                        key_points TEXT, -- JSON string array
                        examples TEXT, -- JSON string array
                        common_mistakes TEXT, -- JSON string array
                        quiz TEXT, -- JSON structure of multiple choice / quiz tasks
                        notes TEXT DEFAULT '',
                        is_bookmarked INTEGER DEFAULT 0, -- 0 or 1
                        PRIMARY KEY (id, canvas_id),
                        FOREIGN KEY (canvas_id) REFERENCES canvases(id) ON DELETE CASCADE
                    )
                """)
                
                # 3. Canvas Edges table (Dependency / prerequisite connections)
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS canvas_edges (
                        id TEXT NOT NULL,
                        canvas_id TEXT NOT NULL,
                        source_id TEXT NOT NULL,
                        target_id TEXT NOT NULL,
                        PRIMARY KEY (id, canvas_id),
                        FOREIGN KEY (canvas_id) REFERENCES canvases(id) ON DELETE CASCADE
                    )
                """)
                
                # Indexes
                conn.execute("CREATE INDEX IF NOT EXISTS idx_canvases_user ON canvases(user_id)")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_nodes_canvas ON canvas_nodes(canvas_id)")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_edges_canvas ON canvas_edges(canvas_id)")
                
                conn.commit()
                logger.info("InSpace SQLite Database initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize InSpace SQLite database: {e}")

    def create_canvas(self, canvas_id: str, user_id: str, topic: str, document_id: Optional[str] = None) -> bool:
        """Create a new canvas workspace metadata record"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    INSERT OR REPLACE INTO canvases (id, user_id, topic, document_id, created_at, last_accessed)
                    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """, (canvas_id, user_id, topic, document_id))
                conn.commit()
                return True
        except Exception as e:
            logger.error(f"Error creating canvas: {e}")
            return False

    def save_canvas_structure(self, canvas_id: str, nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> bool:
        """Saves or updates the structural nodes and edge connections of a canvas"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                # 1. Insert or update nodes
                for node in nodes:
                    key_points_json = json.dumps(node.get("key_points", []))
                    examples_json = json.dumps(node.get("examples", []))
                    mistakes_json = json.dumps(node.get("common_mistakes", []))
                    quiz_json = json.dumps(node.get("quiz", []))
                    
                    conn.execute("""
                        INSERT OR REPLACE INTO canvas_nodes (
                            id, canvas_id, label, x, y, difficulty, 
                            mastery, confidence, attempts, time_spent, 
                            explanation, key_points, examples, common_mistakes, quiz, notes, is_bookmarked
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        node["id"], canvas_id, node["label"], node.get("x", 0.0), node.get("y", 0.0),
                        node.get("difficulty", "Beginner"), node.get("mastery", 0.0), node.get("confidence", 0.0),
                        node.get("attempts", 0), node.get("time_spent", 0), node.get("explanation", ""),
                        key_points_json, examples_json, mistakes_json, quiz_json, node.get("notes", ""), node.get("is_bookmarked", 0)
                    ))
                
                # 2. Re-create edges (delete and insert fresh)
                conn.execute("DELETE FROM canvas_edges WHERE canvas_id = ?", (canvas_id,))
                for edge in edges:
                    conn.execute("""
                        INSERT INTO canvas_edges (id, canvas_id, source_id, target_id)
                        VALUES (?, ?, ?, ?)
                    """, (edge["id"], canvas_id, edge["source"], edge["target"]))
                    
                conn.commit()
                return True
        except Exception as e:
            logger.error(f"Error saving canvas structure: {e}")
            return False

    def get_canvas(self, canvas_id: str) -> Optional[Dict[str, Any]]:
        """Get complete canvas data (nodes, edges, metadata)"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                
                # Metadata
                cursor = conn.execute("SELECT * FROM canvases WHERE id = ?", (canvas_id,))
                canvas_meta = cursor.fetchone()
                if not canvas_meta:
                    return None
                    
                canvas_dict = dict(canvas_meta)
                
                # Update last accessed
                conn.execute("UPDATE canvases SET last_accessed = CURRENT_TIMESTAMP WHERE id = ?", (canvas_id,))
                
                # Nodes
                cursor = conn.execute("SELECT * FROM canvas_nodes WHERE canvas_id = ?", (canvas_id,))
                nodes = []
                for row in cursor.fetchall():
                    node = dict(row)
                    # Decode JSON fields safely
                    node["key_points"] = json.loads(node.get("key_points") or "[]")
                    node["examples"] = json.loads(node.get("examples") or "[]")
                    node["common_mistakes"] = json.loads(node.get("common_mistakes") or "[]")
                    node["quiz"] = json.loads(node.get("quiz") or "[]")
                    nodes.append(node)
                
                # Edges
                cursor = conn.execute("SELECT * FROM canvas_edges WHERE canvas_id = ?", (canvas_id,))
                edges = [dict(row) for row in cursor.fetchall()]
                
                canvas_dict["nodes"] = nodes
                canvas_dict["edges"] = edges
                return canvas_dict
        except Exception as e:
            logger.error(f"Error getting canvas: {e}")
            return None

    def get_user_canvases(self, user_id: str) -> List[Dict[str, Any]]:
        """Retrieve list of all canvases belonging to a user"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.execute("""
                    SELECT c.*, COUNT(n.id) as node_count
                    FROM canvases c
                    LEFT JOIN canvas_nodes n ON c.id = n.canvas_id
                    WHERE c.user_id = ?
                    GROUP BY c.id
                    ORDER BY c.last_accessed DESC
                """, (user_id,))
                return [dict(row) for row in cursor.fetchall()]
        except Exception as e:
            logger.error(f"Error getting user canvases: {e}")
            return []

    def update_node_mastery(self, canvas_id: str, node_id: str, mastery: float, confidence: float, attempts_increment: int = 1, time_increment: int = 0) -> bool:
        """Update mastery progress for a specific node in a canvas"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    UPDATE canvas_nodes
                    SET mastery = ?,
                        confidence = ?,
                        attempts = attempts + ?,
                        time_spent = time_spent + ?
                    WHERE canvas_id = ? AND id = ?
                """, (mastery, confidence, attempts_increment, time_increment, canvas_id, node_id))
                conn.commit()
                return True
        except Exception as e:
            logger.error(f"Error updating node mastery: {e}")
            return False

    def update_node_notes(self, canvas_id: str, node_id: str, notes: str, is_bookmarked: int) -> bool:
        """Update user notes and bookmark state on a concept node"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    UPDATE canvas_nodes
                    SET notes = ?, is_bookmarked = ?
                    WHERE canvas_id = ? AND id = ?
                """, (notes, is_bookmarked, canvas_id, node_id))
                conn.commit()
                return True
        except Exception as e:
            logger.error(f"Error updating node notes: {e}")
            return False

    def delete_canvas(self, canvas_id: str) -> bool:
        """Deletes a canvas and all associated nodes and edges cascade-style"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("DELETE FROM canvases WHERE id = ?", (canvas_id,))
                conn.commit()
                return True
        except Exception as e:
            logger.error(f"Error deleting canvas: {e}")
            return False

# Global Instance
inspace_db = InSpaceDatabase()
