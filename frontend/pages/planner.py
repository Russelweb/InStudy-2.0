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
                course_id = st.session_state.get("current_course", "")
                args = (course_id, edate.strftime("%Y-%m-%d"), [t.strip() for t in topics.split("\n") if t.strip()], headers)
                res, err = run_with_dynamic_progress(_create_planner_api, args=args, estimated_time=6.0)
                if res:
                    st.session_state.study_plan = res["plan"]
                    st.rerun()
        st.markdown('</div>', unsafe_allow_html=True)

    # Display Plan
    if "study_plan" in st.session_state:
        plan = st.session_state.study_plan
        
        st.markdown("<h2 style='margin-top:2.5rem; text-align:center;'>⚡ Intelligence Architecture</h2>", unsafe_allow_html=True)
        
        # Horizontal Timeline Container
        if "weeks" in plan:
            for i, week in enumerate(plan["weeks"]):
                st.markdown(f"""
                <div class="plan-card" style="border-left: 4px solid #FF7F50;">
                    <div class="week-header">PHASE {week.get('week_number', i + 1)}: {week.get('focus', 'Deep Study').upper()}</div>
                """, unsafe_allow_html=True)
                
                cols = st.columns(len(week.get("days", [])) if week.get("days") else 1)
                for i, day in enumerate(week.get("days", [])):
                    with cols[i]:
                        st.markdown(f"""
                        <div style="background:rgba(255,255,255,0.02); padding:1rem; border-radius:15px; border:1px solid rgba(255,255,255,0.05); height:100%;">
                            <div style="color:#FF7F50; font-weight:700; font-size:0.9rem; margin-bottom:0.5rem;">{day['day'].upper()}</div>
                            <div style="font-size:0.85rem; color:rgba(255,255,255,0.8);">
                                {"".join([f'• {task}<br>' for task in (day.get("tasks", []) if isinstance(day.get("tasks", []), list) else [day.get("tasks", "")])])}
                            </div>
                            <div style="font-size:0.7rem; color:rgba(255,127,80,0.6); margin-top:10px; font-weight:600;">⏱️ {day.get('duration', '1.5h')}</div>
                        </div>
                        """, unsafe_allow_html=True)
                st.markdown('</div>', unsafe_allow_html=True)
        
        st.markdown("<br>", unsafe_allow_html=True)
        col_s, col_t = st.columns(2)
        with col_s:
            st.markdown("<h4 style='color:#FF7F50;'>🔄 Optimized Revision</h4>", unsafe_allow_html=True)
            rev_plan = plan.get("revision_plan", [])
            if isinstance(rev_plan, str): rev_plan = [rev_plan]
            for tip in rev_plan:
                st.markdown(f"<div style='background:rgba(251, 191, 36, 0.05); border:1px solid rgba(251, 191, 36, 0.2); padding:10px; border-radius:12px; margin-bottom:8px; font-size:0.9rem;'>{tip}</div>", unsafe_allow_html=True)
        with col_t:
            st.markdown("<h4 style='color:#34D399;'>💡 Strategic Insights</h4>", unsafe_allow_html=True)
            ex_tips = plan.get("exam_tips", [])
            if isinstance(ex_tips, str): ex_tips = [ex_tips]
            for tip in ex_tips:
                st.markdown(f"<div style='background:rgba(52, 211, 153, 0.05); border:1px solid rgba(52, 211, 153, 0.2); padding:10px; border-radius:12px; margin-bottom:8px; font-size:0.9rem;'>{tip}</div>", unsafe_allow_html=True)
