import streamlit as st
import requests
import os
from utils.auth_utils import auth_manager

API_URL = os.getenv("API_URL", "http://localhost:8000")

def show():
    st.title("📚 My Courses")
    
    user_id = st.session_state.user_id
    
    # Course creation
    with st.expander("➕ Create New Course"):
        course_name = st.text_input("Course Name")
        if st.button("Create Course"):
            if course_name:
                course_id = course_name.lower().replace(" ", "_")
                # Create course directory
                import pathlib
                course_dir = pathlib.Path(f"../backend/uploads/{user_id}/{course_id}")
                course_dir.mkdir(parents=True, exist_ok=True)
                
                st.success(f"Course '{course_name}' created!")
                st.session_state.current_course = course_id
                st.rerun()
            else:
                st.error("Please enter a course name")
    
    st.divider()
    
    # Fetch real courses with authentication
    try:
        headers = auth_manager.get_auth_headers()
        response = requests.get(f"{API_URL}/api/stats/courses", headers=headers)
        if response.status_code == 200:
            data = response.json()
            courses = data.get("courses", [])
        else:
            courses = []
    except:
        st.error("Could not fetch courses. Make sure backend is running.")
        courses = []
    
    if not courses:
        st.info("No courses yet. Create your first course above!")
        return
    
    # Display courses
    cols = st.columns(2)
    for idx, course in enumerate(courses):
        with cols[idx % 2]:
            with st.container():
                st.subheader(course["name"])
                st.caption(f"{course['document_count']} documents")
                
                # Show document list
                if course.get("documents"):
                    with st.expander("View Documents"):
                        for doc in course["documents"]:
                            st.text(f"📄 {doc}")
                
                col1, col2, col3 = st.columns(3)
                with col1:
                    if st.button("Select", key=f"open_{idx}"):
                        st.session_state.current_course = course["id"]
                        st.success(f"Selected {course['name']}")
                with col2:
                    if st.button("Upload", key=f"upload_{idx}"):
                        st.session_state.current_course = course["id"]
                        st.info("Go to AI Tutor to upload documents")
                with col3:
                    if st.button("Delete", key=f"delete_{idx}"):
                        st.warning(f"Delete feature coming soon")
                
                st.divider()
