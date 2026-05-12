import sqlite3
import os

db_path = 'backend/backend/users.db'
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
    exit(0)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    cursor.execute('ALTER TABLE users ADD COLUMN policy_accepted INTEGER DEFAULT 0')
    conn.commit()
    print("Column 'policy_accepted' added successfully.")
except sqlite3.OperationalError as e:
    if "duplicate column name" in str(e).lower():
        print("Column 'policy_accepted' already exists.")
    else:
        print(f"Error: {e}")
except Exception as e:
    print(f"Unexpected error: {e}")
finally:
    conn.close()
