import streamlit as st
import plotly.graph_objects as go
import requests
import os
from datetime import datetime, timedelta

API_URL = os.getenv("API_URL", "http://localhost:8000")

def show():
    st.title("📊 Dashboard")
    
    user_id = st.session_state.user_id
    
    # Fetch real stats
    try:
        response = requests.get(f"{API_URL}/api/stats/stats/{user_id}")
        if response.status_code == 200:
            stats = response.json()
        else:
            stats = {
                "total_documents": 0,
                "total_courses": 0,
                "recent_questions": [],
                "study_hours": 0,
                "quizzes_taken": 0
            }
    except:
        st.error("Could not fetch stats. Make sure backend is running.")
        stats = {
            "total_documents": 0,
            "total_courses": 0,
            "recent_questions": [],
            "study_hours": 0,
            "quizzes_taken": 0
        }
    
    # Stats
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric("Documents", stats["total_documents"])
    with col2:
        st.metric("Courses", stats["total_courses"])
    with col3:
        st.metric("Study Hours", f"{stats['study_hours']:.1f}")
    with col4:
        st.metric("Quizzes Taken", stats["quizzes_taken"])
    
    st.divider()
    
    # Recent activity
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("Recent Questions")
        if stats["recent_questions"]:
            for q in reversed(stats["recent_questions"][-5:]):  # Last 5
                with st.container():
                    st.info(f"**{q.get('course', 'Unknown')}**: {q.get('question', 'N/A')}")
                    st.caption(f"Asked: {q.get('timestamp', 'Unknown')[:10]}")
        else:
            st.caption("No questions asked yet. Go to AI Tutor to start!")
    
    with col2:
        st.subheader("Your Courses")
        if stats.get("courses"):
            for course in stats["courses"][:5]:  # Show first 5
                with st.container():
                    st.success(f"**{course['name']}**")
                    st.caption(f"{course['document_count']} documents")
        else:
            st.caption("No courses yet. Go to Courses to create one!")
