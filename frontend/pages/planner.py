import streamlit as st
import requests
import os
from datetime import datetime, timedelta

API_URL = os.getenv("API_URL", "http://localhost:8000")

def show():
    st.title("📅 Study Planner")
    
    # Plan creation
    with st.form("study_plan_form"):
        course_name = st.text_input("Course Name", value=st.session_state.get("current_course", "").replace("_", " ").title())
        exam_date = st.date_input("Exam Date", min_value=datetime.now())
        topics_input = st.text_area("Topics (one per line)", placeholder="Linear Regression\nNeural Networks\nDecision Trees")
        
        submitted = st.form_submit_button("🎯 Generate Study Plan")
        
        if submitted:
            topics = [t.strip() for t in topics_input.split("\n") if t.strip()]
            
            if not course_name or not topics:
                st.error("Please fill in all fields")
            else:
                with st.spinner("Creating your personalized study plan..."):
                    try:
                        response = requests.post(
                            f"{API_URL}/api/planner/create",
                            json={
                                "user_id": st.session_state.user_id,
                                "course_name": course_name,
                                "exam_date": exam_date.strftime("%Y-%m-%d"),
                                "topics": topics
                            }
                        )
                        
                        if response.status_code == 200:
                            st.session_state.study_plan = response.json()["plan"]
                            st.success("Study plan created!")
                        else:
                            st.error("Failed to create plan")
                    except Exception as e:
                        st.error(f"Error: {str(e)}")
    
    st.divider()
    
    # Display study plan
    if "study_plan" in st.session_state:
        plan = st.session_state.study_plan
        
        st.subheader("📚 Your Study Schedule")
        
        # Weekly breakdown
        if "weeks" in plan:
            for week in plan["weeks"]:
                with st.expander(f"Week {week['week_number']}: {week.get('focus', 'Study Week')}"):
                    for day in week.get("days", []):
                        st.markdown(f"**{day['day']}** ({day.get('duration', 'N/A')})")
                        for task in day.get("tasks", []):
                            st.markdown(f"- {task}")
                        st.divider()
        
        # Revision plan
        if "revision_plan" in plan:
            st.subheader("🔄 Revision Strategy")
            for tip in plan["revision_plan"]:
                st.info(tip)
        
        # Exam tips
        if "exam_tips" in plan:
            st.subheader("💡 Exam Tips")
            for tip in plan["exam_tips"]:
                st.success(tip)
