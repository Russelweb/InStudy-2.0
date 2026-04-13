import streamlit as st
import requests
import os
from utils.auth_utils import auth_manager
from utils.ui_utils import run_with_dynamic_progress
from components.document_viewer import show_document_panel

API_URL = os.getenv("API_URL", "http://localhost:8000")

def _generate_summary_api(course_id, document_name, style, headers):
    style_map = {"Short": "short", "Bullet Points": "bullet", "Detailed": "detailed", "Exam Revision": "exam"}
    try:
        response = requests.post(f"{API_URL}/api/summary/generate", json={"course_id": course_id, "document_name": document_name or None, "style": style_map.get(style, "short")}, headers=headers, timeout=300)
        return response.json() if response.status_code == 200 else None
    except Exception as e: raise e

def show():
    # Page Style
    st.markdown("""
    <style>
    .summary-hero {
        background: linear-gradient(135deg, rgba(255, 127, 80, 0.1) 0%, rgba(129, 140, 248, 0.1) 100%);
        border-radius: 28px;
        padding: 3rem;
        border: 1px solid rgba(255, 255, 255, 0.05);
        text-align: center;
        margin-bottom: 2rem;
    }
    .summary-content {
        background: rgba(21, 30, 46, 0.4);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 24px;
        padding: 2.5rem;
        font-size: 1.1rem;
        line-height: 1.8;
        color: rgba(255, 255, 255, 0.9);
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
    }
    </style>
    """, unsafe_allow_html=True)

    if not st.session_state.current_course:
        st.warning("Please select a course first")
        return
        
    st.markdown(f"""
    <div class="summary-hero">
        <h1 style='color: #FF7F50; margin:0;'>📝 Summary Generation</h1>
        <p style='color: rgba(255,255,255,0.5); font-weight:300;'>Condensed intelligence from your study materials</p>
    </div>
    """, unsafe_allow_html=True)
    
    show_document_panel("summary")
    
    # Options Row
    c1, c2 = st.columns([1, 1])
    with c1: style_sel = st.selectbox("Synthesis Style", ["Short", "Bullet Points", "Detailed", "Exam Revision"])
    with c2: doc_name = st.text_input("Specific File (optional)", placeholder="All documents")
    
    col_btn, _ = st.columns([1, 2])
    with col_btn:
        if st.button("✨ SUMMARIZE", use_container_width=True):
            messages = ["Reading document structure...", "Analyzing core themes...", "Synthesizing intelligence...", "Structuring summary..."]
            headers = auth_manager.get_auth_headers()
            args = (st.session_state.current_course, doc_name, style_sel, headers)
            res, err = run_with_dynamic_progress(_generate_summary_api, args=args, messages=messages, estimated_time=6.0)
            if res:
                st.session_state.current_summary = res
                st.rerun()

    # Display Content
    if "current_summary" in st.session_state:
        res = st.session_state.current_summary
        
        # Extract dictionary if present, else fallback
        summary_text = res.get("summary", "") if isinstance(res, dict) else res
        mind_map     = res.get("mind_map", "") if isinstance(res, dict) else None

        st.markdown("<h3 style='margin-top:2rem;'>📖 Intelligence Briefing</h3>", unsafe_allow_html=True)
        st.markdown(f'<div class="summary-content">{summary_text}</div>', unsafe_allow_html=True)
        st.markdown("<br>", unsafe_allow_html=True)
        
        if mind_map:
            with st.expander("🗺️ CONCEPTUAL TRACE MAP", expanded=True):
                st.markdown('<div class="summary-content" style="padding:1rem;">', unsafe_allow_html=True)
                st.graphviz_chart(mind_map, use_container_width=True)
                st.markdown('</div>', unsafe_allow_html=True)

        st.download_button("📥 EXPORT AS TEXT", summary_text, file_name=f"Summary_{style_sel}.txt", use_container_width=True)
