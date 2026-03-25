import streamlit as st
import requests
import os
import pathlib
from utils.auth_utils import auth_manager
from utils.api_utils import get_courses, clear_api_cache

API_URL = os.getenv("API_URL", "http://localhost:8000")

def show():
    st.markdown("""
    <style>
    .course-card {
        background: rgba(21, 30, 46, 0.4);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 24px;
        padding: 2rem;
        margin-bottom: 1.5rem;
        transition: transform 0.3s, border-color 0.3s;
    }
    .course-card:hover {
        transform: translateY(-5px);
        border-color: rgba(255, 127, 80, 0.3);
    }
    .selected-border {
        border: 2px solid #FF7F50 !important;
        background: rgba(255, 127, 80, 0.05) !important;
    }
    .course-title {
        font-size: 1.4rem;
        font-weight: 700;
        color: white;
        margin-bottom: 0.5rem;
    }
    .doc-count {
        font-size: 0.85rem;
        color: rgba(255, 255, 255, 0.4);
        text-transform: uppercase;
        letter-spacing: 1px;
    }
    </style>
    """, unsafe_allow_html=True)

    st.title("📚 Study Courses")
    
    # Creation Entry
    with st.expander("🆕 CREATE NEW COURSE"):
        cname = st.text_input("Course Name (e.g., Computer Science 101)")
        c_btn, _ = st.columns([1, 2])
        with c_btn:
            if st.button("Initialize Course", use_container_width=True):
                if cname:
                    cid = cname.lower().replace(" ", "_").strip()
                    course_dir = pathlib.Path(f"../backend/uploads/{st.session_state.user_id}/{cid}")
                    course_dir.mkdir(parents=True, exist_ok=True)
                    st.session_state.current_course = cid
                    clear_api_cache()
                    st.success(f"Initialized: {cname}")
                    st.rerun()
                
    st.divider()
    
    headers = auth_manager.get_auth_headers()
    courses = get_courses(headers)
    
    if not courses:
        st.info("No learning assets yet. Initialize one above.")
        return
        
    cols = st.columns(2)
    for idx, course in enumerate(courses):
        is_selected = st.session_state.get("current_course") == course["id"]
        with cols[idx % 2]:
            st.markdown(f"""
            <div class="course-card {'selected-border' if is_selected else ''}">
                <div class="doc-count">{course['document_count']} DOCUMENTS</div>
                <div class="course-title">{course['name']}</div>
            </div>
            """, unsafe_allow_html=True)
            
            c1, c2 = st.columns(2)
            with c1:
                if st.button("SELECT COURSE", key=f"sel_{idx}", use_container_width=True):
                    st.session_state.current_course = course["id"]
                    st.rerun()
            with c2:
                if st.button("EXPLORE", key=f"exp_{idx}", use_container_width=False):
                    st.session_state.current_course = course["id"]
                    st.session_state.selected_page = "AI Tutor"
                    st.rerun()
            st.markdown("<br>", unsafe_allow_html=True)
