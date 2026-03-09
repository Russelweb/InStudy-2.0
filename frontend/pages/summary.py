import streamlit as st
import requests
import os

API_URL = os.getenv("API_URL", "http://localhost:8000")

def show():
    st.title("📝 Smart Summary")
    
    if not st.session_state.current_course:
        st.warning("Please select a course first")
        return
    
    st.info(f"Course: {st.session_state.current_course.replace('_', ' ').title()}")
    
    # Summary options
    col1, col2 = st.columns(2)
    
    with col1:
        summary_style = st.selectbox(
            "Summary Style",
            ["Short", "Bullet Points", "Detailed", "Exam Revision"]
        )
    
    with col2:
        document_name = st.text_input("Document Name (optional)", placeholder="Leave empty for all documents")
    
    if st.button("✨ Generate Summary", use_container_width=True):
        # Create progress container
        progress_container = st.empty()
        status_container = st.empty()
        
        try:
            style_map = {
                "Short": "short",
                "Bullet Points": "bullet",
                "Detailed": "detailed",
                "Exam Revision": "exam"
            }
            
            # Show progress
            with progress_container:
                progress_bar = st.progress(0)
                with status_container:
                    st.info("🔍 Loading documents...")
                
                progress_bar.progress(25)
                
                with status_container:
                    st.info("📖 Reading content...")
                
                progress_bar.progress(50)
                
                with status_container:
                    st.info(f"✍️ Creating {summary_style.lower()} summary...")
            
            response = requests.post(
                f"{API_URL}/api/summary/generate",
                json={
                    "user_id": st.session_state.user_id,
                    "course_id": st.session_state.current_course,
                    "document_name": document_name if document_name else None,
                    "style": style_map[summary_style]
                },
                timeout=120
            )
            
            with progress_container:
                progress_bar.progress(90)
                with status_container:
                    st.info("✅ Finalizing summary...")
            
            if response.status_code == 200:
                with progress_container:
                    progress_bar.progress(100)
                    with status_container:
                        st.success("🎉 Summary ready!")
                
                summary = response.json()["summary"]
                st.session_state.current_summary = summary
                
                # Clear progress after a moment
                import time
                time.sleep(1)
                progress_container.empty()
                status_container.empty()
                
                st.success("Summary generated!")
                st.rerun()
            else:
                progress_container.empty()
                status_container.empty()
                st.error("Failed to generate summary")
        except Exception as e:
            progress_container.empty()
            status_container.empty()
            st.error(f"Error: {str(e)}")
    
    st.divider()
    
    # Display summary
    if "current_summary" in st.session_state:
        st.subheader("Summary")
        st.markdown(st.session_state.current_summary)
        
        # Export options
        col1, col2 = st.columns(2)
        with col1:
            st.download_button(
                "📥 Download as TXT",
                st.session_state.current_summary,
                file_name="summary.txt",
                mime="text/plain"
            )
