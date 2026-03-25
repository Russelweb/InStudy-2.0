import streamlit as st
import requests
import os
from datetime import datetime
from utils.auth_utils import auth_manager
from utils.ui_utils import run_with_dynamic_progress
from components.document_viewer import show_document_panel

API_URL = os.getenv("API_URL", "http://localhost:8000")

def _create_planner_api(course_name, exam_date, topics, headers):
    try:
        response = requests.post(f"{API_URL}/api/planner/create", json={"course_name": course_name, "exam_date": exam_date, "topics": topics}, headers=headers, timeout=300)
        return response.json() if response.status_code == 200 else None
    except Exception as e: raise e

def show():
    st.markdown("""
    <style>
    .plan-card {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 20px;
        padding: 1.5rem;
        margin-bottom: 1rem;
    }
    .week-header {
        color: #FF7F50;
        font-weight: 800;
        font-size: 1.2rem;
        margin-bottom: 1rem;
    }
    .day-item {
        border-left: 2px solid rgba(255, 127, 80, 0.3);
        padding-left: 1rem;
        margin-bottom: 1.2rem;
    }
    </style>
    """, unsafe_allow_html=True)

    st.title("📅 Study Planner")
    show_document_panel("planner")
    
    # Form Card
    with st.container():
        st.markdown('<div class="plan-card">', unsafe_allow_html=True)
        with st.form("study_plan_form", clear_on_submit=False):
            st.subheader("Plan Parameters")
            c1, c2 = st.columns(2)
            with c1: cname = st.text_input("Course", value=st.session_state.get("current_course", "").replace("_"," ").title())
            with c2: edate = st.date_input("Exam Date", min_value=datetime.now())
            topics = st.text_area("Key Topics (one per line)", placeholder="Topic 1\nTopic 2")
            
            # Width reduction for form button
            c_btn, _ = st.columns([1, 1])
            with c_btn:
                submitted = st.form_submit_button("🔥 CONSTRUCT PLAN", use_container_width=True)
            
            if submitted:
                headers = auth_manager.get_auth_headers()
                args = (cname, edate.strftime("%Y-%m-%d"), [t.strip() for t in topics.split("\n") if t.strip()], headers)
                res, err = run_with_dynamic_progress(_create_planner_api, args=args, estimated_time=40.0)
                if res:
                    st.session_state.study_plan = res["plan"]
                    st.rerun()
        st.markdown('</div>', unsafe_allow_html=True)

    # Display Plan
    if "study_plan" in st.session_state:
        plan = st.session_state.study_plan
        
        st.markdown("<h2 style='margin-top:2rem;'>📅 Your Personalized Architecture</h2>", unsafe_allow_html=True)
        
        if "weeks" in plan:
            for week in plan["weeks"]:
                with st.container():
                    st.markdown(f'<div class="plan-card"><div class="week-header">WEEK {week["week_number"]} — {week.get("focus", "Study Phase")}</div>', unsafe_allow_html=True)
                    for day in week.get("days", []):
                        st.markdown(f"""
                        <div class="day-item">
                            <div style='font-weight:700; color:white;'>{day['day']}</div>
                            <div style='font-size:0.9rem; color:rgba(255,255,255,0.6);'>{' • '.join(day.get('tasks', []))}</div>
                        </div>
                        """, unsafe_allow_html=True)
                    st.markdown('</div>', unsafe_allow_html=True)
        
        col_s, col_t = st.columns(2)
        with col_s:
            st.subheader("🔄 Revision Strategy")
            for tip in plan.get("revision_plan", []): st.info(tip)
        with col_t:
            st.subheader("💡 Exam Intelligence")
            for tip in plan.get("exam_tips", []): st.success(tip)
