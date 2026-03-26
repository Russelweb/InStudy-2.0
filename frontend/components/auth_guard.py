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
    with st.form("login_form", border=False):
        st.markdown("""
        <div class="login-header-internal">
            <h1>Login</h1>
            <p>WELCOME BACK PLEASE LOGIN TO YOUR ACCOUNT</p>
        </div>
        """, unsafe_allow_html=True)
        
        email = st.text_input("Email Address", placeholder="name@example.com")
        password = st.text_input("Password", type="password", placeholder="••••••••")
        
        c1, c2 = st.columns([1, 1])
        with c1:
            st.checkbox("Remember Me", value=True)
        with c2:
            st.markdown("<p style='text-align:right; margin-top:5px;'><a href='#' class='auth-link'>Forgot Password?</a></p>", unsafe_allow_html=True)
        
        login_button = st.form_submit_button("LOGIN", use_container_width=True)
        
        st.markdown("""
        <div style="text-align: center; margin-top: 1.5rem;">
            <p style="color: rgba(255,255,255,0.4); font-size: 0.85rem;">
                Don't have an account? <span style="color: #FF6B35; font-weight: 600; cursor: pointer;">Signup</span>
            </p>
        </div>
        """, unsafe_allow_html=True)

        if st.form_submit_button("Switch to Signup", help="Click here if you don't have an account"):
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
                    st.success("Login successful!")
                    st.rerun()
                else:
                    st.error(f"Login failed: {message}")

def show_signup_form():
    """Display signup form"""
    with st.form("signup_form", border=False):
        st.markdown("""
        <div class="login-header-internal">
            <h1>Register</h1>
            <p>JOIN THE FUTURE OF STUDYING</p>
        </div>
        """, unsafe_allow_html=True)
        
        email = st.text_input("Email Address", placeholder="name@example.com")
        password = st.text_input("New Password", type="password", placeholder="Min 8 characters")
        confirm_password = st.text_input("Confirm Password", type="password", placeholder="Re-enter password")
        
        signup_button = st.form_submit_button("CREATE ACCOUNT", use_container_width=True)
        
        if st.form_submit_button("Already have an account? Login"):
            st.session_state.show_signup = False
            st.rerun()
    
    if signup_button:
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
                        st.success("Account created successfully!")
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
                auth_manager.clear_session()
                st.error("Your session has expired. Please log in again.")
    
    # Inject Premium Glassmorphism CSS and Background Blobs
    st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600&family=Inter:wght@400;700;900&display=swap');

    /* Ensure all Streamlit layout containers are transparent */
    .stApp, [data-testid="stAppViewContainer"], [data-testid="stHeader"], [data-testid="stMain"], .main, .block-container {
        background-color: transparent !important;
    }
    
    /* Solid Black Base on Body */
    body {
        background-color: #000000 !important;
    }
    
    /* Deep Glowing Background Planets */
    .blob-container {
        position: fixed;
        width: 100vw;
        height: 100vh;
        top: 0;
        left: 0;
        z-index: -1;
        overflow: hidden;
        pointer-events: none;
    }
    
    .blob {
        position: absolute;
        border-radius: 50%;
        filter: blur(60px); /* Sharper planets */
        opacity: 0.8;
        animation: floatPlanets 40s infinite alternate ease-in-out;
    }
    
    .blob-1 {
        width: 600px;
        height: 600px;
        background: radial-gradient(circle, rgba(138, 43, 226, 0.45) 0%, rgba(75, 0, 130, 0.05) 75%, transparent 100%);
        top: -15%;
        left: -8%;
    }
    
    .blob-2 {
        width: 700px;
        height: 700px;
        background: radial-gradient(circle, rgba(255, 127, 80, 0.4) 0%, rgba(255, 69, 0, 0.05) 75%, transparent 100%);
        bottom: -20%;
        right: -8%;
        animation-delay: -10s;
    }
    
    .blob-3 {
        width: 380px;
        height: 380px;
        background: radial-gradient(circle, rgba(65, 105, 225, 0.3) 0%, rgba(65, 105, 225, 0) 100%);
        top: 35%;
        left: 55%;
        animation-delay: -20s;
    }
    
    @keyframes floatPlanets {
        0% { transform: translate(0, 0) scale(1); }
        100% { transform: translate(50px, 30px) scale(1.03); }
    }

    /* Primary Branding - The "Aura" Logo */
    .app-logo-outer {
        text-align: center;
        margin-top: 4rem;
        margin-bottom: 2rem;
        z-index: 10;
        position: relative;
    }
    .app-logo-outer h1 {
        font-family: 'Inter', sans-serif !important;
        background: linear-gradient(135deg, #FF7F50 0%, #FF6347 50%, #FF2E63 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-weight: 900 !important;
        font-size: 5rem !important;
        letter-spacing: -3px !important;
        margin: 0 !important;
        filter: drop-shadow(0 0 25px rgba(255, 127, 80, 0.3)) !important;
        animation: pulseAura 4s infinite alternate ease-in-out;
    }
    
    /* Responsive Branding and Card */
    @media (max-width: 768px) {
        .app-logo-outer h1 { font-size: 3.5rem !important; letter-spacing: -1.5px !important; }
        .login-header-internal h2 { font-size: 2.8rem !important; }
        div[data-testid="stForm"] { 
            padding: 2.5rem 1.5rem !important; 
            margin: 0.5rem !important; 
            border-radius: 25px !important; 
        }
    }
    @media (max-width: 480px) {
        .app-logo-outer h1 { font-size: 2.5rem !important; letter-spacing: -1px !important; }
        .login-header-internal h2 { font-size: 2.2rem !important; }
    }
    @keyframes pulseAura {
        from { filter: drop-shadow(0 0 15px rgba(255, 127, 80, 0.2)); transform: scale(1); }
        to { filter: drop-shadow(0 0 35px rgba(255, 127, 80, 0.5)); transform: scale(1.02); }
    }
    
    /* The Glass Card */
    div[data-testid="stForm"] {
        background: rgba(255, 255, 255, 0.02) !important;
        backdrop-filter: blur(50px) !important;
        -webkit-backdrop-filter: blur(50px) !important;
        border: 1px solid rgba(255, 255, 255, 0.05) !important;
        border-radius: 40px !important;
        padding: 4rem 3.5rem !important;
        box-shadow: 0 45px 120px rgba(0, 0, 0, 0.8) !important;
        max-width: 460px;
        margin: 0 auto 3rem auto !important;
    }
    
    /* Header inside card */
    .login-header-internal {
        margin-bottom: 3rem;
        text-align: left;
    }
    .login-header-internal h2 {
        font-family: 'Playfair Display', serif !important;
        font-size: 3.5rem !important;
        font-weight: 500 !important;
        color: white !important;
        margin: 0 !important;
        line-height: 1 !important;
    }
    .login-header-internal p {
        color: rgba(255, 255, 255, 0.4) !important;
        font-family: 'Inter', sans-serif !important;
        font-size: 0.7rem !important;
        font-weight: 500 !important;
        letter-spacing: 2px !important;
        text-transform: uppercase !important;
        margin-top: 1rem !important;
    }
    
    /* Input Styling - Soft Line Concept */
    div[data-testid="stTextInput"] input {
        background: transparent !important;
        border: none !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.15) !important;
        border-radius: 0px !important;
        height: 50px !important;
        color: white !important;
        font-size: 1rem !important;
        padding: 0 !important;
        transition: 0.3s !important;
    }
    
    div[data-testid="stTextInput"] input:focus {
        border-bottom: 2px solid #FF7F50 !important;
        outline: none !important;
        box-shadow: none !important;
    }
    
    div[data-testid="stTextInput"] label {
        color: rgba(255, 255, 255, 0.4) !important;
        font-weight: 400 !important;
        font-size: 0.75rem !important;
        margin-bottom: -5px !important;
        text-transform: uppercase;
        letter-spacing: 1px;
    }

    /* Buttons Hierarchy */
    button[kind="secondaryFormSubmit"] {
        height: 55px !important;
        border-radius: 12px !important;
        font-weight: 700 !important;
        transition: 0.3s !important;
        letter-spacing: 1px !important;
    }
    
    /* Primary Action (LOGIN) */
    div[data-testid="stForm"] > div:nth-last-child(3) button {
        background: #FF6B35 !important;
        color: white !important;
        border: none !important;
        width: 100% !important;
        box-shadow: 0 15px 35px rgba(255, 107, 53, 0.25) !important;
        font-size: 1rem !important;
        margin-top: 2rem !important;
    }
    
    div[data-testid="stForm"] > div:nth-last-child(3) button:hover {
        background: #FF7F50 !important;
        transform: translateY(-2px);
    }

    /* Alternative Action (Switch) */
    div[data-testid="stForm"] > div:last-child button {
        background: rgba(255, 255, 255, 0.05) !important;
        color: rgba(255, 255, 255, 0.5) !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
        font-size: 0.85rem !important;
        font-weight: 500 !important;
        margin-top: 2rem !important;
    }

    div[data-testid="stForm"] > div:last-child button:hover {
        background: #FF7F50 !important;
        color: white !important;
        border-color: #FF7F50 !important;
        box-shadow: 0 10px 25px rgba(255, 127, 80, 0.2) !important;
    }
    
    /* Footer branding */
    .app-brand-footer {
        text-align: center;
        margin-top: 4rem;
        opacity: 0.15;
        font-weight: 300;
        letter-spacing: 3px;
        text-transform: uppercase;
        font-size: 0.65rem;
        color: white !important;
    }
    </style>
    
    <div class="blob-container">
        <div class="blob blob-1"></div>
        <div class="blob blob-2"></div>
        <div class="blob blob-3"></div>
    </div>
    """, unsafe_allow_html=True)
    
    # Large Radiant Branding
    st.markdown("""
    <div class="app-logo-outer">
        <h1>InStudy 2.0</h1>
    </div>
    """, unsafe_allow_html=True)

    # Determine which form to show
    show_signup_form_flag = st.session_state.get("show_signup", False)
    
    col_l, col_c, col_r = st.columns([1, 2, 1])
    with col_c:
        if show_signup_form_flag:
            show_signup_form()
        else:
            show_login_form()
    
    st.markdown("""
    <div class="app-info-footer">
        📚 InStudy 2.0 · Personalized AI Study Intelligence
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