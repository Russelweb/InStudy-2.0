#!/usr/bin/env python3
"""
Demo script showing page-aware AI tutor capabilities
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.rag_service import RAGService

def demo_page_aware_features():
    """Demonstrate the new page-aware features"""
    
    print("🎓 InStudy 2.0 - Page-Aware AI Tutor Demo")
    print("=" * 50)
    
    rag_service = RAGService()
    
    # Demo queries
    demo_queries = [
        "What's on page 24?",
        "Solve exercise 1.12",
        "Explain the concept on pg 15",
        "Help me with problem 3.4",
        "What does p. 42 say about derivatives?",
        "Question 7 is confusing",
        "Regular question about calculus"
    ]
    
    print("\n🔍 Query Analysis Demo:")
    print("-" * 30)
    
    for query in demo_queries:
        print(f"\n📝 Query: '{query}'")
        
        # Check for page reference
        page_ref = rag_service._extract_page_reference(query)
        if page_ref:
            print(f"   📄 Page detected: {page_ref}")
        
        # Check for exercise reference
        exercise_ref = rag_service._extract_exercise_reference(query)
        if exercise_ref:
            print(f"   🎯 Exercise detected: {exercise_ref}")
        
        if not page_ref and not exercise_ref:
            print(f"   💬 General query (no specific page/exercise)")
    
    print("\n🧠 Memory System Demo:")
    print("-" * 25)
    
    # Simulate conversation memory
    user_id = "demo_user"
    course_id = "mathematics"
    
    # Add some conversations to memory
    conversations = [
        ("What is calculus?", "Calculus is the study of change and motion..."),
        ("Explain derivatives", "Derivatives measure the rate of change..."),
        ("How do I solve limits?", "Limits describe the behavior of functions...")
    ]
    
    print(f"\n📚 Adding conversations to memory for {user_id} in {course_id}:")
    for q, a in conversations:
        rag_service._add_to_memory(user_id, course_id, q, a)
        print(f"   ✅ Added: '{q[:30]}...'")
    
    # Show memory status
    status = rag_service.get_memory_status(user_id, course_id)
    print(f"\n📊 Memory Status: {status}")
    
    # Show conversation context
    context = rag_service._get_conversation_context(user_id, course_id)
    print(f"\n💭 Generated Context ({len(context)} chars):")
    print(f"   {context[:100]}...")
    
    # Clear memory demo
    print(f"\n🗑️ Clearing memory...")
    rag_service.clear_memory(user_id, course_id)
    status_after = rag_service.get_memory_status(user_id, course_id)
    print(f"   📊 After clearing: {status_after}")
    
    print("\n✨ Feature Highlights:")
    print("-" * 20)
    print("✅ Page-specific queries: 'page 24', 'pg 15', 'p. 42'")
    print("✅ Exercise references: 'exercise 1.12', 'problem 3.4'")
    print("✅ Conversation memory: Remembers last 5 Q&A pairs")
    print("✅ Context awareness: Links current questions to previous answers")
    print("✅ Memory management: Check status and clear when needed")
    print("✅ Smart retrieval: Focuses on relevant page/exercise content")
    
    print("\n🚀 Ready for enhanced learning experience!")

if __name__ == "__main__":
    demo_page_aware_features()