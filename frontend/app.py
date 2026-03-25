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

# Inject Premium Dark Fintech CSS
st.markdown("""
<style>
/* Modern Font Import */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

html, body, [data-testid="stAppViewContainer"] {
    font-family: 'Inter', sans-serif;
    background: linear-gradient(135deg, #0B1120 0%, #111827 100%) !important;
}

/* Glassmorphism Navigation Bar */
div[data-testid="stHorizontalBlock"]:has(ul.nav),
nav.nav.nav-pills {
    position: fixed !important;
    top: 2.875rem;
    left: 0;
    right: 0;
    z-index: 1000;
    background: rgba(17, 24, 39, 0.7) !important;
    backdrop-filter: blur(12px) !important;
    -webkit-backdrop-filter: blur(12px) !important;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.3);
    padding: 0.5rem 2rem !important;
}

/* Main Content Spacing */
section.main > div.block-container {
    padding-top: 7.5rem !important;
    padding-left: 2rem !important;
    padding-right: 2rem !important;
}

/* Custom Dark Scrollbar */
::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}
::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.2);
}
::-webkit-scrollbar-thumb {
    background: rgba(255, 127, 80, 0.2);
    border-radius: 10px;
}
::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 127, 80, 0.4);
}

/* Fix for Plotly Chart Backgrounds */
.js-plotly-plot .plotly .main-svg {
    background: transparent !important;
}

/* Button Styling Override */
div.stButton > button {
    background: linear-gradient(90deg, #FF7F50 0%, #FF6347 100%) !important;
    color: white !important;
    border: none !important;
    border-radius: 12px !important;
    padding: 0.6rem 1.5rem !important;
    font-weight: 600 !important;
    transition: all 0.3s ease !important;
    box-shadow: 0 4px 15px rgba(255, 127, 80, 0.3) !important;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-size: 0.9rem !important;
}

div.stButton > button:hover {
    transform: translateY(-2px) !important;
    box-shadow: 0 6px 20px rgba(255, 127, 80, 0.5) !important;
}

/* Sidebar Styling */
section[data-testid="stSidebar"] {
    background-color: #0F172A !important;
    border-right: 1px solid rgba(255, 255, 255, 0.05);
}

/* Metric Styling */
[data-testid="stMetricValue"] {
    font-size: 1.8rem !important;
    font-weight: 700 !important;
    color: #FF7F50 !important;
}

/* Progress bar color */
.stProgress > div > div > div > div {
    background-image: linear-gradient(to right, #FF7F50, #FF6347) !important;
}

/* Hide Streamlit elements */
#MainMenu {visibility: hidden;}
footer {visibility: hidden;}
header {visibility: hidden;}

</style>
""", unsafe_allow_html=True)

# Main navigation menu (horizontal at top, now fixed)
selected = option_menu(
    menu_title=None,
    options=menu_options,
    icons=menu_icons,
    default_index=menu_options.index(st.session_state.selected_page) if st.session_state.selected_page in menu_options else 0,
    orientation="horizontal",
    key="main_menu",
    styles={
        "container": {
            "padding": "0!important", 
            "background-color": "transparent",
            "border-radius": "0"
        },
        "icon": {"color": "#FF7F50", "font-size": "18px"}, 
        "nav-link": {
            "font-size": "15px", 
            "text-align": "center", 
            "margin":"0px", 
            "color": "rgba(255,255,255,0.7)",
            "font-weight": "500",
            "transition": "all 0.3s ease"
        },
        "nav-link-selected": {
            "background": "rgba(255, 127, 80, 0.1)",
            "color": "#FF7F50",
            "border-bottom": "2px solid #FF7F50",
            "border-radius": "0"
        },
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
