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
from pages import dashboard, courses, ai_tutor, flashcards, quiz, summary, planner, mastery, admin_dashboard

# Build menu options based on user role
menu_options = ["Dashboard", "Courses", "AI Tutor", "Flashcards", "Quiz", "Summary", "Study Planner", "Mastery"]
menu_icons = ["house", "book", "chat", "card-list", "question-circle", "file-text", "calendar", "bullseye"]

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
    background: #080c16 !important; /* Slightly lighter rich navy for better depth */
}

/* Glassmorphism Sidebar */
section[data-testid="stSidebar"] {
    background-color: rgba(15, 23, 42, 0.4) !important;
    backdrop-filter: blur(25px) !important;
    -webkit-backdrop-filter: blur(25px) !important;
    border-right: 1px solid rgba(255, 255, 255, 0.05) !important;
}
section[data-testid="stSidebar"] [data-testid="stVerticalBlock"] {
    background: transparent !important;
}

/* Glassmorphism Navigation Bar */
div[data-testid="stHorizontalBlock"]:has(ul.nav),
nav.nav.nav-pills {
    position: fixed !important;
    top: 0 !important;
    left: 0;
    right: 0;
    z-index: 1000;
    background: rgba(8, 12, 22, 0.8) !important;
    backdrop-filter: blur(20px) !important;
    -webkit-backdrop-filter: blur(20px) !important;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.3);
    padding: 0.5rem 2rem !important;
}

/* Main Content Spacing */
section.main > div.block-container {
    padding-top: 6rem !important;
    padding-left: 3rem !important;
    padding-right: 3rem !important;
}

/* Global Glass Card Style for common containers */
div[data-testid="stExpander"], 
div[data-testid="stChatMessage"],
[data-testid="stForm"],
div[data-testid="stMetric"] {
    background: rgba(255, 255, 255, 0.03) !important;
    backdrop-filter: blur(15px) !important;
    border: 1px solid rgba(255, 255, 255, 0.06) !important;
    border-radius: 20px !important;
    padding: 1.5rem !important;
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
    background: rgba(255, 127, 80, 0.15);
    border-radius: 10px;
}
::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 127, 80, 0.4);
}

/* Primary Buttons (Pure Coral Focus - The Lead) */
button[kind="primary"], div.stButton > button:not([kind="secondary"]) {
    background: linear-gradient(90deg, #FF7F50 0%, #FF6347 100%) !important;
    color: white !important;
    border: none !important;
    border-radius: 12px !important;
    padding: 0.6rem 2.2rem !important;
    font-weight: 700 !important;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
    box-shadow: 0 10px 25px rgba(255, 127, 80, 0.2) !important;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    font-size: 0.85rem !important;
}

button[kind="primary"]:hover, div.stButton > button:not([kind="secondary"]):hover {
    transform: translateY(-2px) !important;
    box-shadow: 0 15px 40px rgba(255, 127, 80, 0.4) !important;
    background: #FF6347 !important;
    opacity: 1 !important;
}

/* Alternative/Secondary Buttons (Muted Sage Accents) */
button[kind="secondary"] {
    background: rgba(67, 126, 111, 0.05) !important;
    color: rgba(255, 255, 255, 0.6) !important;
    border: 1px solid rgba(67, 126, 111, 0.2) !important;
    border-radius: 12px !important;
    padding: 0.6rem 2.2rem !important;
    font-weight: 600 !important;
    transition: all 0.3s ease !important;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    font-size: 0.85rem !important;
}

button[kind="secondary"]:hover {
    background: rgba(67, 126, 111, 0.2) !important;
    color: white !important;
    border-color: #437e6f !important;
    transform: translateY(-2px) !important;
}

/* Sidebar Styling Enhancement */
.stSidebar h1 {
    color: #FF7F50 !important;
    font-weight: 800 !important;
}

/* Metric Styling */
[data-testid="stMetricValue"] {
    font-size: 2.2rem !important;
    font-weight: 800 !important;
    color: white !important;
    filter: drop-shadow(0 0 10px rgba(255, 127, 80, 0.2));
}

/* Progress bar color (Subtle Sage-Coral Mix) */
.stProgress > div > div > div > div {
    background-image: linear-gradient(to right, #FF7F50, #437e6f) !important;
}

/* Hide specific Streamlit brand elements but keep the header area for controls */
#MainMenu {visibility: hidden;}
footer {visibility: hidden;}
header[data-testid="stHeader"] {background: transparent !important;}

/* Ensure sidebar toggle button is visible and styled */
[data-testid="stSidebarCollapsedControl"] {
    background-color: rgba(255, 127, 80, 0.1) !important;
    border-radius: 0 8px 8px 0 !important;
    color: #FF7F50 !important;
    top: 10px !important;
}

/* --- RESPONSIVE NAVIGATION OVERRIDES --- */

/* 1. Desktop: Hide Mobile Menu, keep Horizontal UI */
@media (min-width: 769px) {
    /* Hide the mobile nav container in the sidebar */
    [data-testid="stSidebar"] .mobile-nav-container {
        display: none !important;
    }
}

/* 2. Mobile: Hide Top Menu, show Sidebar Menu */
@media (max-width: 768px) {
    /* Hide the top horizontal menu */
    .top-nav-container {
        display: none !important;
    }
    
    /* Make the mobile sidebar menu visible and pretty */
    [data-testid="stSidebar"] .mobile-nav-container {
        display: block !important;
        margin-top: 1rem;
    }

    section.main > div.block-container {
        padding-top: 2rem !important; /* Less padding on mobile since top-bar is gone */
    }
}

/* Sticky Top Bar Container */
.top-nav-container {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    background: rgba(8, 12, 22, 0.8) !important;
    backdrop-filter: blur(20px) !important;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
</style>
""", unsafe_allow_html=True)

# --- NAVIGATION LOGIC ---

# 1. Top Navigation (Desktop Only)
st.markdown('<div class="top-nav-container">', unsafe_allow_html=True)
selected_top = option_menu(
    menu_title=None,
    options=menu_options,
    icons=menu_icons,
    default_index=menu_options.index(st.session_state.selected_page) if st.session_state.selected_page in menu_options else 0,
    orientation="horizontal",
    key="main_menu_desktop",
    styles={
        "container": {"padding": "0!important", "background-color": "transparent", "border-radius": "0"},
        "icon": {"color": "#FF7F50", "font-size": "18px"}, 
        "nav-link": {"font-size": "14px", "text-align": "center", "margin":"0px", "color": "rgba(255,255,255,0.7)", "transition": "all 0.3s ease"},
        "nav-link-selected": {"background": "rgba(255, 127, 80, 0.1)", "color": "#FF7F50", "border-bottom": "2px solid #FF7F50", "border-radius": "0"},
    }
)
st.markdown('</div>', unsafe_allow_html=True)

# 2. Sidebar Navigation (Mobile Only + User Info)
with st.sidebar:
    st.title("📚 InStudy 2.0")
    st.caption("Your AI Study Assistant")
    st.divider()
    
    # The Mobile Menu (Hidden on Desktop via CSS)
    st.markdown('<div class="mobile-nav-container">', unsafe_allow_html=True)
    selected_mobile = option_menu(
        menu_title="Navigation",
        options=menu_options,
        icons=menu_icons,
        default_index=menu_options.index(st.session_state.selected_page) if st.session_state.selected_page in menu_options else 0,
        orientation="vertical",
        key="main_menu_mobile",
        styles={
            "container": {"padding": "5px", "background-color": "rgba(255,255,255,0.02)", "border-radius": "15px"},
            "icon": {"color": "#437e6f", "font-size": "16px"}, 
            "nav-link": {"font-size": "14px", "text-align": "left", "margin":"5px", "color": "rgba(255,255,255,0.8)"},
            "nav-link-selected": {"background": "linear-gradient(90deg, #FF7F50, #437e6f)", "color": "white"},
        }
    )
    st.markdown('</div>', unsafe_allow_html=True)
    
    st.divider()
    show_user_info()
    st.divider()
    
    # Groq API Key Configuration
    st.subheader("⚙️ LLM Settings")
    st.caption("Enter your Groq API Key to power InStudy 2.0.")
    
    # Get initial value from session state
    current_key = st.session_state.get("groq_api_key", "")
    
    new_key = st.text_input(
        "Groq API Key", 
        value=current_key,
        type="password",
        help="Get your key from https://console.groq.com/keys",
        placeholder="gsk_..."
    )
    
    if new_key != current_key:
        st.session_state.groq_api_key = new_key
        st.success("API Key saved!")
        st.rerun()
        
    if st.session_state.get("groq_api_key"):
        if st.button("Clear API Key", key="clear_groq_key"):
            st.session_state.groq_api_key = ""
            st.rerun()

# 3. Synchronize Selections
new_selection = st.session_state.selected_page
if selected_top != st.session_state.selected_page:
    new_selection = selected_top
elif selected_mobile != st.session_state.selected_page:
    new_selection = selected_mobile

if new_selection != st.session_state.selected_page:
    st.session_state.selected_page = new_selection
    st.rerun()
    
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
if st.session_state.selected_page == "Dashboard":
    dashboard.show()
elif st.session_state.selected_page == "Courses":
    courses.show()
elif st.session_state.selected_page == "AI Tutor":
    ai_tutor.show()
elif st.session_state.selected_page == "Flashcards":
    flashcards.show()
elif st.session_state.selected_page == "Quiz":
    quiz.show()
elif st.session_state.selected_page == "Summary":
    summary.show()
elif st.session_state.selected_page == "Study Planner":
    planner.show()
elif st.session_state.selected_page == "Mastery":
    mastery.show()
elif st.session_state.selected_page == "Admin Panel":
    admin_dashboard.show()
