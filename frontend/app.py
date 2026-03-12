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
if "selected_page" not in st.session_state:
    st.session_state.selected_page = "Dashboard"

# Import pages
from pages import dashboard, courses, ai_tutor, flashcards, quiz, summary, planner, admin_dashboard

# Build menu options based on user role
menu_options = ["Dashboard", "Courses", "AI Tutor", "Flashcards", "Quiz", "Summary", "Study Planner"]
menu_icons = ["house", "book", "chat", "card-list", "question-circle", "file-text", "calendar"]

# Add admin option if user is admin
if current_user and current_user.get("is_admin"):
    menu_options.append("Admin Panel")
    menu_icons.append("shield-lock")

# Main navigation menu (horizontal at bottom)
selected = option_menu(
    menu_title=None,
    options=menu_options,
    icons=menu_icons,
    default_index=menu_options.index(st.session_state.selected_page) if st.session_state.selected_page in menu_options else 0,
    orientation="horizontal",
    key="main_menu",  # Add key for proper state management
    styles={
        "container": {"padding": "0!important", "background-color": "#fafafa"},
        "icon": {"color": "orange", "font-size": "18px"}, 
        "nav-link": {"font-size": "16px", "text-align": "center", "margin":"0px", "--hover-color": "#eee"},
        "nav-link-selected": {"background-color": "green"},
    }
)

# Update session state when selection changes
if selected != st.session_state.selected_page:
    st.session_state.selected_page = selected

# Sidebar with user info only
with st.sidebar:
    st.title("📚 InStudy 2.0")
    st.caption("Your AI Study Assistant")
    
    # Show current page
    st.info(f"📍 Current: **{selected}**")
    
    # Show user info and logout button
    show_user_info()

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
