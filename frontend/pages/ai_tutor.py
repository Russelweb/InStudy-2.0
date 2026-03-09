import streamlit as st
import requests
import os
import json

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
        
        # Get AI response with streaming
        with st.chat_message("assistant"):
            message_placeholder = st.empty()
            sources_placeholder = st.empty()
            
            full_response = ""
            sources = []
            
            try:
                # Use streaming endpoint
                response = requests.post(
                    f"{API_URL}/api/chat/ask-stream",
                    json={
                        "user_id": st.session_state.user_id,
                        "course_id": st.session_state.current_course,
                        "question": question,
                        "use_eli12": use_eli12
                    },
                    stream=True,
                    timeout=120
                )
                
                if response.status_code == 200:
                    # Process streaming response
                    for line in response.iter_lines():
                        if line:
                            line = line.decode('utf-8')
                            if line.startswith('data: '):
                                try:
                                    data = json.loads(line[6:])  # Remove 'data: ' prefix
                                    
                                    if data['type'] == 'metadata':
                                        sources = data.get('sources', [])
                                    
                                    elif data['type'] == 'content':
                                        full_response += data['text']
                                        # Update the message with cursor
                                        message_placeholder.markdown(full_response + "▌")
                                    
                                    elif data['type'] == 'done':
                                        # Remove cursor and show final message
                                        message_placeholder.markdown(full_response)
                                        if sources:
                                            sources_placeholder.caption(f"📄 Sources: {', '.join(sources)}")
                                    
                                    elif data['type'] == 'error':
                                        st.error(f"Error: {data['message']}")
                                        break
                                
                                except json.JSONDecodeError:
                                    continue
                    
                    # Add to chat history
                    st.session_state.chat_history.append({
                        "role": "assistant",
                        "content": full_response,
                        "sources": sources
                    })
                else:
                    st.error(f"Failed to get response: {response.status_code}")
                    
            except requests.exceptions.ConnectionError:
                st.error("❌ Cannot connect to backend. Make sure it's running.")
            except requests.exceptions.Timeout:
                st.error("❌ Request timed out.")
            except Exception as e:
                st.error(f"Error: {str(e)}")
                import traceback
                st.error(traceback.format_exc())

