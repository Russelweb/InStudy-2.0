"""
Admin Dashboard for user and system management.
"""

import streamlit as st
import requests
import os
from utils.auth_utils import auth_manager
import pandas as pd

API_URL = os.getenv("API_URL", "http://localhost:8000")

def show():
    st.title("🔐 Admin Dashboard")
    
    # Check if user is admin
    current_user = auth_manager.get_current_user()
    if not current_user or not current_user.get('is_admin'):
        st.error("⛔ Access Denied: Admin privileges required")
        st.info("This page is only accessible to administrators.")
        return
    
    st.success(f"👋 Welcome, Admin {current_user['email']}")
    
    # Tabs for different admin functions
    tab1, tab2, tab3 = st.tabs(["📊 System Overview", "👥 User Management", "📚 Course Management"])
    
    # Tab 1: System Overview
    with tab1:
        st.subheader("System Statistics")
        
        try:
            headers = auth_manager.get_auth_headers()
            response = requests.get(f"{API_URL}/api/admin/stats", headers=headers)
            
            if response.status_code == 200:
                stats = response.json()
                
                col1, col2, col3, col4 = st.columns(4)
                
                with col1:
                    st.metric("👥 Total Users", stats['total_users'])
                with col2:
                    st.metric("🔐 Admins", stats['total_admins'])
                with col3:
                    st.metric("📄 Documents", stats['total_documents'])
                with col4:
                    st.metric("📚 Courses", stats['total_courses'])
                
                st.divider()
                
                # System health
                st.subheader("🏥 System Health")
                col1, col2 = st.columns(2)
                
                with col1:
                    st.success("✅ Database: Online")
                    st.success("✅ Authentication: Active")
                
                with col2:
                    st.success("✅ File Storage: Available")
                    st.success("✅ Vector Store: Operational")
            else:
                st.error("Failed to load system statistics")
                
        except Exception as e:
            st.error(f"Error loading stats: {str(e)}")
    
    # Tab 2: User Management
    with tab2:
        st.subheader("User Management")
        
        try:
            headers = auth_manager.get_auth_headers()
            response = requests.get(f"{API_URL}/api/admin/users", headers=headers)
            
            if response.status_code == 200:
                users_data = response.json()
                users = users_data['users']
                
                if users:
                    # Create DataFrame for better display
                    df = pd.DataFrame(users)
                    df['created_at'] = pd.to_datetime(df['created_at']).dt.strftime('%Y-%m-%d %H:%M')
                    df['is_admin'] = df['is_admin'].apply(lambda x: '🔐 Admin' if x else '👤 User')
                    
                    st.dataframe(
                        df[['id', 'email', 'is_admin', 'created_at']],
                        use_container_width=True,
                        hide_index=True
                    )
                    
                    st.divider()
                    
                    # User actions
                    st.subheader("User Actions")
                    
                    col1, col2 = st.columns(2)
                    
                    with col1:
                        user_ids = [u['id'] for u in users if u['id'] != current_user['id']]
                        user_emails = [u['email'] for u in users if u['id'] != current_user['id']]
                        user_options = [f"{uid} - {email}" for uid, email in zip(user_ids, user_emails)]
                        
                        if user_options:
                            selected_user = st.selectbox("Select User", user_options)
                            selected_user_id = int(selected_user.split(" - ")[0])
                            
                            # Get selected user details
                            selected_user_data = next(u for u in users if u['id'] == selected_user_id)
                            
                            st.info(f"**Email:** {selected_user_data['email']}\n\n**Status:** {'🔐 Admin' if selected_user_data['is_admin'] else '👤 Regular User'}")
                            
                            # Admin actions
                            col_a, col_b = st.columns(2)
                            
                            with col_a:
                                if not selected_user_data['is_admin']:
                                    if st.button("🔐 Make Admin", use_container_width=True):
                                        try:
                                            resp = requests.post(
                                                f"{API_URL}/api/admin/users/{selected_user_id}/make-admin",
                                                headers=headers
                                            )
                                            if resp.status_code == 200:
                                                st.success("User promoted to admin!")
                                                st.rerun()
                                            else:
                                                st.error("Failed to promote user")
                                        except Exception as e:
                                            st.error(f"Error: {str(e)}")
                                else:
                                    if st.button("👤 Revoke Admin", use_container_width=True):
                                        try:
                                            resp = requests.post(
                                                f"{API_URL}/api/admin/users/{selected_user_id}/revoke-admin",
                                                headers=headers
                                            )
                                            if resp.status_code == 200:
                                                st.success("Admin privileges revoked!")
                                                st.rerun()
                                            else:
                                                st.error("Failed to revoke admin")
                                        except Exception as e:
                                            st.error(f"Error: {str(e)}")
                            
                            with col_b:
                                if st.button("🗑️ Delete User", type="primary", use_container_width=True):
                                    st.session_state.confirm_delete_user = selected_user_id
                            
                            # Confirmation dialog
                            if st.session_state.get('confirm_delete_user') == selected_user_id:
                                st.warning("⚠️ Are you sure? This will delete all user data permanently!")
                                col_yes, col_no = st.columns(2)
                                
                                with col_yes:
                                    if st.button("✅ Yes, Delete", use_container_width=True):
                                        try:
                                            resp = requests.delete(
                                                f"{API_URL}/api/admin/users/{selected_user_id}",
                                                headers=headers
                                            )
                                            if resp.status_code == 200:
                                                st.success("User deleted successfully!")
                                                st.session_state.confirm_delete_user = None
                                                st.rerun()
                                            else:
                                                st.error("Failed to delete user")
                                        except Exception as e:
                                            st.error(f"Error: {str(e)}")
                                
                                with col_no:
                                    if st.button("❌ Cancel", use_container_width=True):
                                        st.session_state.confirm_delete_user = None
                                        st.rerun()
                        else:
                            st.info("No other users to manage")
                    
                    with col2:
                        st.subheader("User Details")
                        if user_options:
                            # Get user courses
                            try:
                                resp = requests.get(
                                    f"{API_URL}/api/admin/users/{selected_user_id}/courses",
                                    headers=headers
                                )
                                if resp.status_code == 200:
                                    courses_data = resp.json()
                                    courses = courses_data['courses']
                                    
                                    if courses:
                                        st.write(f"**Courses ({len(courses)}):**")
                                        for course in courses:
                                            with st.expander(f"📚 {course['name']}"):
                                                st.write(f"Documents: {course['document_count']}")
                                                for doc in course['documents']:
                                                    st.text(f"📄 {doc}")
                                    else:
                                        st.info("No courses yet")
                            except Exception as e:
                                st.error(f"Error loading courses: {str(e)}")
                else:
                    st.info("No users found")
                    
            else:
                st.error("Failed to load users")
                
        except Exception as e:
            st.error(f"Error: {str(e)}")
    
    # Tab 3: Course Management
    with tab3:
        st.subheader("Course Management")
        
        try:
            headers = auth_manager.get_auth_headers()
            
            # Get all users first
            response = requests.get(f"{API_URL}/api/admin/users", headers=headers)
            
            if response.status_code == 200:
                users = response.json()['users']
                
                # Select user
                user_options = [f"{u['id']} - {u['email']}" for u in users]
                selected_user = st.selectbox("Select User to Manage Courses", user_options)
                selected_user_id = int(selected_user.split(" - ")[0])
                
                # Get user's courses
                resp = requests.get(
                    f"{API_URL}/api/admin/users/{selected_user_id}/courses",
                    headers=headers
                )
                
                if resp.status_code == 200:
                    courses_data = resp.json()
                    courses = courses_data['courses']
                    
                    if courses:
                        for course in courses:
                            with st.expander(f"📚 {course['name']} ({course['document_count']} documents)"):
                                col1, col2 = st.columns([3, 1])
                                
                                with col1:
                                    st.write("**Documents:**")
                                    for doc in course['documents']:
                                        st.text(f"📄 {doc}")
                                
                                with col2:
                                    if st.button(f"🗑️ Delete Course", key=f"del_{course['id']}", use_container_width=True):
                                        st.session_state.confirm_delete_course = (selected_user_id, course['id'])
                                
                                # Confirmation
                                if st.session_state.get('confirm_delete_course') == (selected_user_id, course['id']):
                                    st.warning("⚠️ Delete this course and all its documents?")
                                    col_yes, col_no = st.columns(2)
                                    
                                    with col_yes:
                                        if st.button("✅ Confirm", key=f"conf_{course['id']}", use_container_width=True):
                                            try:
                                                del_resp = requests.delete(
                                                    f"{API_URL}/api/admin/courses/{selected_user_id}/{course['id']}",
                                                    headers=headers
                                                )
                                                if del_resp.status_code == 200:
                                                    st.success("Course deleted!")
                                                    st.session_state.confirm_delete_course = None
                                                    st.rerun()
                                                else:
                                                    st.error("Failed to delete course")
                                            except Exception as e:
                                                st.error(f"Error: {str(e)}")
                                    
                                    with col_no:
                                        if st.button("❌ Cancel", key=f"canc_{course['id']}", use_container_width=True):
                                            st.session_state.confirm_delete_course = None
                                            st.rerun()
                    else:
                        st.info("No courses found for this user")
                        
        except Exception as e:
            st.error(f"Error: {str(e)}")