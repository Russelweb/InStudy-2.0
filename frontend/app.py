import streamlit as st
from streamlit_option_menu import option_menu
import requests
from dotenv import load_dotenv
import os

load_dotenv()

# Config
st.set_page_config(
    page_title="InStudy 2.0",
    page_icon="📚",
    layout="wide",
    initial_sidebar_state="expanded"
)

API_URL = os.getenv("API_URL", "http://localhost:8000")

# Session state
if "user_id" not in st.session_state:
    st.session_state.user_id = "demo_user"
if "current_course" not in st.session_state:
    st.session_state.current_course = None
if "chat_history" not in st.session_state:
    st.session_state.chat_history = []

# Sidebar
with st.sidebar:
    st.title("📚 InStudy 2.0")
    st.caption("Your AI Study Assistant")
    
    selected = option_menu(
        menu_title=None,
        options=["Dashboard", "Courses", "AI Tutor", "Flashcards", "Quiz", "Summary", "Study Planner"],
        icons=["house", "book", "chat", "card-list", "question-circle", "file-text", "calendar"],
        default_index=0,
    )
    
    st.divider()
    st.caption(f"User: {st.session_state.user_id}")

# Import pages
from pages import dashboard, courses, ai_tutor, flashcards, quiz, summary, planner

# Route to pages
if selected == "Dashboard":
    dashboard.show()
elif selected == "Courses":
    courses.show()
elif selected == "AI Tutor":
    ai_tutor.show()
elif selected == "Flashcards":
    flashcards.show()
elif selected == "Quiz":
    quiz.show()
elif selected == "Summary":
    summary.show()
elif selected == "Study Planner":
    planner.show()
