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
            # Token expired, clear session
            auth_manager.clear_session()
            st.error("Your session has expired. Please log in again.")
    
    # Show authentication forms
    st.markdown("""
    <div style="text-align: center; padding: 2rem 0;">
        <h1>🎓 InStudy 2.0</h1>
        <p style="font-size: 1.2rem; color: #666;">Your AI-Powered Study Assistant</p>
    </div>
    """, unsafe_allow_html=True)
    
    # Determine which form to show
    show_signup_form_flag = st.session_state.get("show_signup", False)
    
    if show_signup_form_flag:
        show_signup_form()
    else:
        show_login_form()
    
    # Add some helpful information
    st.markdown("---")
    st.markdown("""
    **Features you'll get access to:**
    - 🤖 AI Tutor with document-based Q&A
    - 📚 Smart document processing and organization
    - 🃏 Auto-generated flashcards
    - 📝 Interactive quizzes
    - 📊 Study progress tracking
    - 📅 Personalized study planner
    - 📈 Performance analytics
    """)
    
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