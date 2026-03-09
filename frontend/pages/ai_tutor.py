import streamlit as st
import requests
import os

API_URL = os.getenv("API_URL", "http://localhost:8000")

def show():
    st.title("🤖 AI Tutor")
    
    if not st.session_state.current_course:
        st.warning("Please select a course first from the Courses page")
        return
    
    st.info(f"Current Course: {st.session_state.current_course.replace('_', ' ').title()}")
    
    # Document upload
    with st.expander("📤 Upload Study Material"):
        uploaded_file = st.file_uploader(
            "Upload PDF, TXT, or DOCX",
            type=["pdf", "txt", "docx"]
        )
        
        if uploaded_file and st.button("Process Document"):
            with st.spinner("Processing document..."):
                try:
                    files = {"file": uploaded_file}
                    data = {
                        "user_id": st.session_state.user_id,
                        "course_id": st.session_state.current_course
                    }
                    
                    response = requests.post(
                        f"{API_URL}/api/documents/upload",
                        files=files,
                        data=data,
                        timeout=60
                    )
                    
                    if response.status_code == 200:
                        result = response.json()
                        st.success(f"✅ {result['filename']} processed ({result['chunks']} chunks)")
                    else:
                        error_detail = response.json().get("detail", "Unknown error")
                        st.error(f"Upload failed: {error_detail}")
                        st.error(f"Status code: {response.status_code}")
                except requests.exceptions.ConnectionError:
                    st.error("❌ Cannot connect to backend. Make sure the backend is running on http://localhost:8000")
                except requests.exceptions.Timeout:
                    st.error("❌ Request timed out. The document might be too large.")
                except Exception as e:
                    st.error(f"❌ Error: {str(e)}")
                    st.error(f"Error type: {type(e).__name__}")
    
    st.divider()
    
    # Chat interface
    st.subheader("💬 Ask Your AI Tutor")
    
    # ELI12 mode toggle
    use_eli12 = st.checkbox("🎈 Explain Like I'm 12", help="Get simplified explanations")
    
    # Display chat history
    for msg in st.session_state.chat_history:
        with st.chat_message(msg["role"]):
            st.write(msg["content"])
            if msg.get("sources"):
                st.caption(f"📄 Sources: {', '.join(msg['sources'])}")
    
    # Chat input
    if question := st.chat_input("Ask a question about your study material..."):
        # Add user message
        st.session_state.chat_history.append({"role": "user", "content": question})
        
        with st.chat_message("user"):
            st.write(question)
        
        # Get AI response
        with st.chat_message("assistant"):
            with st.spinner("Thinking..."):
                try:
                    response = requests.post(
                        f"{API_URL}/api/chat/ask",
                        json={
                            "user_id": st.session_state.user_id,
                            "course_id": st.session_state.current_course,
                            "question": question,
                            "use_eli12": use_eli12
                        }
                    )
                    
                    if response.status_code == 200:
                        result = response.json()
                        st.write(result["answer"])
                        
                        if result["sources"]:
                            st.caption(f"📄 Sources: {', '.join(result['sources'])}")
                        
                        st.session_state.chat_history.append({
                            "role": "assistant",
                            "content": result["answer"],
                            "sources": result["sources"]
                        })
                    else:
                        st.error("Failed to get response")
                except Exception as e:
                    st.error(f"Error: {str(e)}")
