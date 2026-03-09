import streamlit as st
import requests
import os

API_URL = os.getenv("API_URL", "http://localhost:8000")

def show():
    st.title("📚 My Courses")
    
    # Course creation
    with st.expander("➕ Create New Course"):
        course_name = st.text_input("Course Name")
        if st.button("Create Course"):
            if course_name:
                st.success(f"Course '{course_name}' created!")
                st.session_state.current_course = course_name.lower().replace(" ", "_")
            else:
                st.error("Please enter a course name")
    
    st.divider()
    
    # Sample courses
    courses = ["Machine Learning", "Discrete Mathematics", "Databases", "Operating Systems"]
    
    cols = st.columns(2)
    for idx, course in enumerate(courses):
        with cols[idx % 2]:
            with st.container():
                st.subheader(course)
                st.caption("4 documents • 12 flashcards")
                
                col1, col2, col3 = st.columns(3)
                with col1:
                    if st.button("Open", key=f"open_{idx}"):
                        st.session_state.current_course = course.lower().replace(" ", "_")
                        st.success(f"Opened {course}")
                with col2:
                    if st.button("Upload", key=f"upload_{idx}"):
                        st.session_state.current_course = course.lower().replace(" ", "_")
                        st.info("Go to AI Tutor to upload documents")
                with col3:
                    if st.button("Stats", key=f"stats_{idx}"):
                        st.info("Study stats coming soon")
                
                st.divider()
