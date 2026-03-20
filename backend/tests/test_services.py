#!/usr/bin/env python3
"""Test script to diagnose service issues - Local Edition"""

import sys
import traceback

print("Testing InStudy 2.0 Services (Local Edition)...")
print("=" * 50)

# Test 1: Config
print("\n1. Testing config...")
try:
    from config import settings
    print(f"✅ Config loaded")
    print(f"   OLLAMA_BASE_URL: {settings.OLLAMA_BASE_URL}")
    print(f"   OLLAMA_MODEL: {settings.OLLAMA_MODEL}")
    print(f"   EMBEDDING_MODEL: {settings.EMBEDDING_MODEL}")
    print(f"   UPLOAD_DIR: {settings.UPLOAD_DIR}")
    print(f"   VECTOR_STORE_DIR: {settings.VECTOR_STORE_DIR}")
except Exception as e:
    print(f"❌ Config failed: {e}")
    traceback.print_exc()
    sys.exit(1)

# Test 2: Global Models
print("\n2. Testing Global Models...")
try:
    from models.global_models import get_embeddings, get_llm
    print(f"✅ Global models module loaded")
    
    # Test embeddings
    print(f"   Loading embeddings...")
    embeddings = get_embeddings()
    print(f"✅ Embeddings loaded")
    
    # Test LLM
    print(f"   Connecting to LLM...")
    llm = get_llm()
    print(f"✅ LLM connected")
except Exception as e:
    print(f"❌ Global models failed: {e}")
    print(f"   Make sure Ollama is running: ollama serve")
    print(f"   Make sure Llama 3 is installed: ollama pull llama3")
    traceback.print_exc()

# Test 2: Document Processor
print("\n2. Testing DocumentProcessor...")
try:
    from services.document_processor import DocumentProcessor
    doc_processor = DocumentProcessor()
    print(f"✅ DocumentProcessor initialized")
except Exception as e:
    print(f"❌ DocumentProcessor failed: {e}")
    traceback.print_exc()

# Test 3: RAG Service
print("\n3. Testing RAGService...")
try:
    from services.rag_service import RAGService
    rag_service = RAGService()
    print(f"✅ RAGService initialized")
except Exception as e:
    print(f"❌ RAGService failed: {e}")
    traceback.print_exc()

# Test 4: Quiz Service
print("\n4. Testing QuizService...")
try:
    from services.quiz_service import QuizService
    quiz_service = QuizService()
    print(f"✅ QuizService initialized")
except Exception as e:
    print(f"❌ QuizService failed: {e}")
    traceback.print_exc()

# Test 5: Flashcard Service
print("\n5. Testing FlashcardService...")
try:
    from services.flashcard_service import FlashcardService
    flashcard_service = FlashcardService()
    print(f"✅ FlashcardService initialized")
except Exception as e:
    print(f"❌ FlashcardService failed: {e}")
    traceback.print_exc()

# Test 6: Summary Service
print("\n6. Testing SummaryService...")
try:
    from services.summary_service import SummaryService
    summary_service = SummaryService()
    print(f"✅ SummaryService initialized")
except Exception as e:
    print(f"❌ SummaryService failed: {e}")
    traceback.print_exc()

# Test 7: Planner Service
print("\n7. Testing PlannerService...")
try:
    from services.planner_service import PlannerService
    planner_service = PlannerService()
    print(f"✅ PlannerService initialized")
except Exception as e:
    print(f"❌ PlannerService failed: {e}")
    traceback.print_exc()

print("\n" + "=" * 50)
print("Testing complete!")
