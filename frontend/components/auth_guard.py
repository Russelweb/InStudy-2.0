"""
Authentication guard component to protect routes and show login/signup forms.
"""

import streamlit as st
from utils.auth_utils import auth_manager
import re

def validate_email(email: str) -> bool:
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_password(password: str) -> tuple[bool, str]:
    """Validate password requirements"""
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    return True, ""

def show_login_form():
    """Display login form"""
    st.markdown("### 🔐 Login to InStudy 2.0")
    st.markdown("Welcome back! Please sign in to access your study materials.")
    
    with st.form("login_form"):
        email = st.text_input("Email Address", placeholder="your.email@example.com")
        password = st.text_input("Password", type="password", placeholder="Enter your password")
        
        col1, col2 = st.columns([1, 1])
        
        with col1:
            login_button = st.form_submit_button("Sign In", use_container_width=True)
        
        with col2:
            if st.form_submit_button("Create Account", use_container_width=True):
                st.session_state.show_signup = True
                st.rerun()
    
    if login_button:
        if not email or not password:
            st.error("Please enter both email and password")
        elif not validate_email(email):
            st.error("Please enter a valid email address")
        else:
            with st.spinner("Signing in..."):
                success, message = auth_manager.login(email, password)
                
                if success:
                    st.success("Login successful! Redirecting...")
                    st.rerun()
                else:
                    st.error(f"Login failed: {message}")

def show_signup_form():
    """Display signup form"""
    st.markdown("### 📝 Create Your Account")
    st.markdown("Join InStudy 2.0 to start your personalized learning journey!")
    
    with st.form("signup_form"):
        email = st.text_input("Email Address", placeholder="your.email@example.com")
        password = st.text_input("Password", type="password", placeholder="Choose a secure password (8+ characters)")
        confirm_password = st.text_input("Confirm Password", type="password", placeholder="Re-enter your password")
        
        col1, col2 = st.columns([1, 1])
        
        with col1:
            signup_button = st.form_submit_button("Create Account", use_container_width=True)
        
        with col2:
            if st.form_submit_button("Back to Login", use_container_width=True):
                st.session_state.show_signup = False
                st.rerun()
    
    if signup_button:
        # Validation
        if not email or not password or not confirm_password:
            st.error("Please fill in all fields")
        elif not validate_email(email):
            st.error("Please enter a valid email address")
        else:
            password_valid, password_error = validate_password(password)
            if not password_valid:
                st.error(password_error)
            elif password != confirm_password:
                st.error("Passwords do not match")
            else:
                with st.spinner("Creating your account..."):
                    success, message = auth_manager.register(email, password, confirm_password)
                    
                    if success:
                        st.success("Account created successfully! Welcome to InStudy 2.0!")
                        st.rerun()
                    else:
                        st.error(f"Registration failed: {message}")

def require_authentication():
    """
    Authentication guard that ensures user is logged in.
    Returns True if authenticated, False otherwise.
    Shows login/signup forms if not authenticated.
    """
    # Check if user is authenticated
    if auth_manager.is_authenticated():
        # Verify token is still valid
        if auth_manager.verify_token():
            return True
        else:
            # Try to recover session first
            if auth_manager.recover_session():
                return True
            else:
                # Token expired or connection issue, clear session
                auth_manager.clear_session()
                st.error("Your session has expired or there was a connection issue. Please log in again.")
    
    # Show authentication forms
    st.markdown("""
    <div style="text-align: center; padding: 3rem 0;">
        <h1 style='color: #FF7F50; font-weight: 800; font-size: 3.5rem; letter-spacing: -1px; margin-bottom: 0;'>InStudy 2.0</h1>
        <p style="font-size: 1.2rem; color: rgba(255,255,255,0.6); font-weight: 300;">Elevate your learning with AI intelligence</p>
    </div>
    
    <style>
    /* Auth Form Card */
    div[data-testid="stForm"] {
        background: rgba(21, 30, 46, 0.6) !important;
        backdrop-filter: blur(10px) !important;
        border: 1px solid rgba(255, 255, 255, 0.05) !important;
        border-radius: 24px !important;
        padding: 2.5rem !important;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4) !important;
    }
    
    /* Input Styling */
    div[data-testid="stTextInput"] input {
        background-color: rgba(255, 255, 255, 0.03) !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
        border-radius: 12px !important;
        color: white !important;
        padding: 0.8rem !important;
    }
    
    div[data-testid="stTextInput"] label {
        color: rgba(255, 255, 255, 0.8) !important;
        font-weight: 500 !important;
        margin-bottom: 0.5rem !important;
    }
    </style>
    """, unsafe_allow_html=True)
    
    # Show connection status (subtle)
    try:
        import requests
        headers = {"timeout": "5"}
        response = requests.get("http://localhost:8000/health", **headers)
        if response.status_code != 200:
             st.caption("⚠️ System check: Backend latency detected")
    except:
        st.error("❌ Connection Offline: Please start the backend on port 8000")
    
    # Determine which form to show
    show_signup_form_flag = st.session_state.get("show_signup", False)
    
    col_l, col_c, col_r = st.columns([1, 2, 1])
    with col_c:
        if show_signup_form_flag:
            show_signup_form()
        else:
            show_login_form()
    
    # Add some helpful information (stylish features grid)
    st.markdown("---")
    st.markdown("""
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 2rem; padding: 2rem 0;">
        <div style="background: rgba(255,255,255,0.03); padding: 1.5rem; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05);">
            <h4 style="color: #FF7F50; margin-top: 0;">🤖 AI Intelligence</h4>
            <p style="color: rgba(255,255,255,0.6); font-size: 0.9rem; margin-bottom: 0;">Context-aware study assistance tailored to your documents.</p>
        </div>
        <div style="background: rgba(255,255,255,0.03); padding: 1.5rem; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05);">
            <h4 style="color: #FF7F50; margin-top: 0;">📊 Performance</h4>
            <p style="color: rgba(255,255,255,0.6); font-size: 0.9rem; margin-bottom: 0;">Real-time analytics and progress tracking.</p>
        </div>
        <div style="background: rgba(255,255,255,0.03); padding: 1.5rem; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05);">
            <h4 style="color: #FF7F50; margin-top: 0;">📅 Smart Planning</h4>
            <p style="color: rgba(255,255,255,0.6); font-size: 0.9rem; margin-bottom: 0;">Optimize your schedule with AI revision cycles.</p>
        </div>
    </div>
    """, unsafe_allow_html=True)
    
    return False

def show_user_info():
    """Display current user information in sidebar"""
    user = auth_manager.get_current_user()
    if user:
        with st.sidebar:
            st.markdown("---")
            st.markdown(f"**👤 Logged in as:**")
            st.markdown(f"📧 {user['email']}")
            
            if st.button("🚪 Logout", use_container_width=True):
                auth_manager.logout()
                st.rerun()