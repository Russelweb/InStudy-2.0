#!/usr/bin/env python3
"""
Test script to verify local setup is working correctly.
Tests embeddings, LLM, and document processing.
"""

import sys
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

print("=" * 60)
print("InStudy 2.0 - Local Setup Verification")
print("=" * 60)

# Test 1: Check Ollama
print("\n1. Testing Ollama connection...")
try:
    import requests
    response = requests.get("http://localhost:11434/api/tags", timeout=5)
    if response.status_code == 200:
        models = response.json().get("models", [])
        model_names = [m["name"] for m in models]
        print(f"   ✅ Ollama is running")
        print(f"   Available models: {', '.join(model_names)}")
        
        if "llama3:latest" in model_names or "llama3" in str(model_names):
            print(f"   ✅ Llama 3 is installed")
        else:
            print(f"   ⚠️  Llama 3 not found. Run: ollama pull llama3")
    else:
        print(f"   ❌ Ollama returned status {response.status_code}")
except requests.exceptions.ConnectionError:
    print(f"   ❌ Cannot connect to Ollama at http://localhost:11434")
    print(f"   Run: ollama serve")
    sys.exit(1)
except Exception as e:
    print(f"   ❌ Error: {e}")
    sys.exit(1)

# Test 2: Load Embeddings
print("\n2. Testing Sentence Transformers embeddings...")
try:
    from models.global_models import get_embeddings
    embeddings = get_embeddings()
    print(f"   ✅ Embeddings model loaded")
    
    # Test embedding
    test_text = "This is a test sentence."
    embedding = embeddings.embed_query(test_text)
    print(f"   ✅ Embedding generated (dimension: {len(embedding)})")
    
except Exception as e:
    print(f"   ❌ Failed to load embeddings: {e}")
    print(f"   Run: pip install sentence-transformers")
    sys.exit(1)

# Test 3: Load LLM
print("\n3. Testing Llama 3 via Ollama...")
try:
    from models.global_models import get_llm
    llm = get_llm()
    print(f"   ✅ LLM connected")
    
    # Test generation
    print(f"   Testing generation (this may take a few seconds)...")
    response = llm.invoke("Say 'Hello from Llama 3!' and nothing else.")
    print(f"   ✅ LLM response: {response[:100]}")
    
except Exception as e:
    print(f"   ❌ Failed to connect to LLM: {e}")
    print(f"   Make sure Ollama is running and llama3 is pulled")
    sys.exit(1)

# Test 4: Document Processor
print("\n4. Testing Document Processor...")
try:
    from services.document_processor import DocumentProcessor
    doc_processor = DocumentProcessor()
    print(f"   ✅ Document processor initialized")
    
except Exception as e:
    print(f"   ❌ Failed to initialize document processor: {e}")
    sys.exit(1)

# Test 5: RAG Service
print("\n5. Testing RAG Service...")
try:
    from services.rag_service import RAGService
    rag_service = RAGService()
    print(f"   ✅ RAG service initialized")
    
except Exception as e:
    print(f"   ❌ Failed to initialize RAG service: {e}")
    sys.exit(1)

# Test 6: Quiz Service
print("\n6. Testing Quiz Service...")
try:
    from services.quiz_service import QuizService
    quiz_service = QuizService()
    print(f"   ✅ Quiz service initialized")
    
except Exception as e:
    print(f"   ❌ Failed to initialize quiz service: {e}")
    sys.exit(1)

# Test 7: Flashcard Service
print("\n7. Testing Flashcard Service...")
try:
    from services.flashcard_service import FlashcardService
    flashcard_service = FlashcardService()
    print(f"   ✅ Flashcard service initialized")
    
except Exception as e:
    print(f"   ❌ Failed to initialize flashcard service: {e}")
    sys.exit(1)

# Test 8: Summary Service
print("\n8. Testing Summary Service...")
try:
    from services.summary_service import SummaryService
    summary_service = SummaryService()
    print(f"   ✅ Summary service initialized")
    
except Exception as e:
    print(f"   ❌ Failed to initialize summary service: {e}")
    sys.exit(1)

# Test 9: Planner Service
print("\n9. Testing Planner Service...")
try:
    from services.planner_service import PlannerService
    planner_service = PlannerService()
    print(f"   ✅ Planner service initialized")
    
except Exception as e:
    print(f"   ❌ Failed to initialize planner service: {e}")
    sys.exit(1)

print("\n" + "=" * 60)
print("✅ All tests passed!")
print("=" * 60)
print("\nYour local setup is working correctly!")
print("\nNext steps:")
print("1. Start backend: uvicorn main:app --reload")
print("2. Start frontend: streamlit run app.py")
print("3. Upload a document and test the system")
print("\nNote: First requests will be slower as models warm up.")
print("=" * 60)
