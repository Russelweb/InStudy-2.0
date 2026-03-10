import streamlit as st
from streamlit_option_menu import option_menu
import requests
from dotenv import load_dotenv
import os

# Import authentication components
from components.auth_guard import require_authentication, show_user_info
from utils.auth_utils import auth_manager

load_dotenv()

# Config
st.set_page_config(
    page_title="InStudy 2.0",
    page_icon="📚",
    layout="wide",
    initial_sidebar_state="expanded"
)

API_URL = os.getenv("API_URL", "http://localhost:8000")

# Authentication check - this must be first
if not require_authentication():
    st.stop()

# Get authenticated user
current_user = auth_manager.get_current_user()
user_id = str(current_user["id"]) if current_user else "demo_user"

# Session state
if "user_id" not in st.session_state:
    st.session_state.user_id = user_id
else:
    st.session_state.user_id = user_id  # Update with authenticated user

if "current_course" not in st.session_state:
    st.session_state.current_course = None
if "chat_history" not in st.session_state:
    st.session_state.chat_history = []

# Sidebar
with st.sidebar:
    st.title("📚 InStudy 2.0")
    st.caption("Your AI Study Assistant")
    
    # Build menu options based on user role
    menu_options = ["Dashboard", "Courses", "AI Tutor", "Flashcards", "Quiz", "Summary", "Study Planner"]
    menu_icons = ["house", "book", "chat", "card-list", "question-circle", "file-text", "calendar"]
    
    # Add admin option if user is admin
    if current_user and current_user.get("is_admin"):
        menu_options.append("Admin Panel")
        menu_icons.append("shield-lock")
    
    selected = option_menu(
        menu_title=None,
        options=menu_options,
        icons=menu_icons,
        default_index=0,
    )
    
    # Show user info and logout button
    show_user_info()

# Import pages
from pages import dashboard, courses, ai_tutor, flashcards, quiz, summary, planner, admin_dashboard

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
elif selected == "Admin Panel":
    admin_dashboard.show()
