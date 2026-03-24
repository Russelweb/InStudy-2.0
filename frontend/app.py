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

# Force token verification to ensure we have fresh user data (including is_admin)
if current_user and not auth_manager.verify_token():
    # If token verification fails, clear session and redirect to login
    auth_manager.clear_session()
    st.rerun()

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

# Inject CSS to make the nav bar sticky at the top
st.markdown("""
<style>
/* Pin the option_menu nav bar to the top of the viewport.
   Targets the first horizontal block which contains the nav ul. */
div[data-testid="stHorizontalBlock"]:has(ul.nav),
nav.nav.nav-pills {
    position: fixed !important;
    top: 2.875rem;
    left: 0;
    right: 0;
    z-index: 999;
    background: #fafafa;
    box-shadow: 0 2px 6px rgba(0,0,0,0.10);
    padding: 0 1rem;
}

/* Push page content down so it doesn't hide under the fixed nav */
section.main > div.block-container {
    padding-top: 5rem !important;
}
</style>
""", unsafe_allow_html=True)

# Main navigation menu (horizontal at top, now fixed)
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
    
    # Temporary debug info
    if current_user:
        with st.expander("🔍 Debug Info", expanded=False):
            st.write("Current User:")
            st.json({
                "id": current_user.get("id"),
                "email": current_user.get("email"), 
                "is_admin": current_user.get("is_admin", False)
            })
            if current_user.get("is_admin"):
                st.success("✅ Admin privileges detected")
            else:
                st.info("ℹ️ Regular user (not admin)")

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
