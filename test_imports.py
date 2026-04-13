import sys
import os
sys.path.append(os.path.abspath('backend'))
try:
    from services.document_processor import DocumentProcessor
    print("SUCCESS: DocumentProcessor imported!")
except ImportError as e:
    print(f"IMPORT ERROR: {e}")
except Exception as e:
    print(f"OTHER ERROR: {e}")
