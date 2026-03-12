import streamlit as st
import requests
import os
import json
from utils.auth_utils import auth_manager

API_URL = os.getenv("API_URL", "http://localhost:8000")

def show():
    st.title("🤖 AI Tutor")
    
    if not st.session_state.current_course:
        st.warning("Please select a course first from the Courses page")
        return
    
    st.info(f"Current Course: {st.session_state.current_course.replace('_', ' ').title()}")
    
    # Show uploaded documents for current course
    with st.expander("📄 Uploaded Documents", expanded=True):
        try:
            headers = auth_manager.get_auth_headers()
            response = requests.get(f"{API_URL}/api/stats/courses", headers=headers)
            if response.status_code == 200:
                data = response.json()
                courses = data.get("courses", [])
                current_course_data = next((c for c in courses if c["id"] == st.session_state.current_course), None)
                
                if current_course_data and current_course_data.get("documents"):
                    st.success(f"✅ {len(current_course_data['documents'])} documents uploaded:")
                    for doc in current_course_data["documents"]:
                        st.text(f"📄 {doc}")
                else:
                    st.info("No documents uploaded yet. Upload some study material below!")
            else:
                st.warning("Could not fetch document list")
        except Exception as e:
            st.warning(f"Could not fetch documents: {str(e)}")
    
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
                        "course_id": st.session_state.current_course
                    }
                    headers = auth_manager.get_auth_headers()
                    
                    response = requests.post(
                        f"{API_URL}/api/documents/upload",
                        files=files,
                        data=data,
                        headers=headers,
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
    
    # Memory status and controls
    with st.expander("🧠 Conversation Memory", expanded=False):
        col_mem1, col_mem2, col_mem3 = st.columns([2, 1, 1])
        
        with col_mem1:
            if st.button("📊 Check Memory Status"):
                try:
                    headers = auth_manager.get_auth_headers()
                    response = requests.get(
                        f"{API_URL}/api/chat/memory/status",
                        params={"course_id": st.session_state.current_course},
                        headers=headers,
                        timeout=10
                    )
                    
                    if response.status_code == 200:
                        status = response.json()
                        st.info(f"💭 Memory entries: {status['memory_count']}")
                        if status['memory_count'] > 0:
                            st.success("✅ AI can reference previous conversations")
                            st.caption("Recent topics: " + ", ".join(status['recent_topics'][:3]))
                        else:
                            st.info("🆕 No conversation history yet")
                    else:
                        st.error("Failed to get memory status")
                except Exception as e:
                    st.error(f"Error checking memory: {str(e)}")
        
        with col_mem2:
            if st.button("🗑️ Clear Memory"):
                try:
                    headers = auth_manager.get_auth_headers()
                    response = requests.delete(
                        f"{API_URL}/api/chat/memory/clear",
                        params={"course_id": st.session_state.current_course},
                        headers=headers,
                        timeout=10
                    )
                    
                    if response.status_code == 200:
                        st.success("✅ Memory cleared!")
                        st.rerun()
                    else:
                        st.error("Failed to clear memory")
                except Exception as e:
                    st.error(f"Error clearing memory: {str(e)}")
        
        with col_mem3:
            st.info("💡 **Tips:**\n- Ask about specific pages: 'page 24'\n- Reference exercises: 'exercise 1.12'\n- AI remembers context")
        
        # Debug section
        with st.expander("🔧 Debug Tools", expanded=False):
            if st.button("🔍 Check Vector Store"):
                try:
                    headers = auth_manager.get_auth_headers()
                    response = requests.post(
                        f"{API_URL}/api/chat/debug/vector-store",
                        params={"course_id": st.session_state.current_course},
                        headers=headers,
                        timeout=10
                    )
                    
                    if response.status_code == 200:
                        debug_info = response.json()
                        if debug_info["status"] == "vector_store_found":
                            st.success(f"✅ Vector store found with {debug_info['document_count']} documents")
                            if debug_info.get("sample_metadata"):
                                st.json(debug_info["sample_metadata"])
                        elif debug_info["status"] == "no_vector_store":
                            st.warning(f"⚠️ {debug_info['message']}")
                            st.info("Try uploading a document first!")
                        else:
                            st.error(f"❌ Error: {debug_info['message']}")
                    else:
                        st.error("Failed to check vector store")
                except Exception as e:
                    st.error(f"Debug check failed: {str(e)}")
    
    # Health check and ELI12 mode in columns
    col1, col2 = st.columns([1, 3])
    
    with col1:
        if st.button("🔍 Test Connection"):
            with st.spinner("Testing connection..."):
                try:
                    headers = auth_manager.get_auth_headers()
                    response = requests.post(
                        f"{API_URL}/api/chat/health",
                        headers=headers,
                        timeout=10
                    )
                    
                    if response.status_code == 200:
                        result = response.json()
                        if result["status"] == "healthy":
                            st.success("✅ Connection healthy!")
                            st.info(f"LLM Response: {result['test_response']}")
                        else:
                            st.error(f"❌ Connection unhealthy: {result.get('error', 'Unknown error')}")
                    else:
                        st.error(f"❌ Health check failed: {response.status_code}")
                        
                except Exception as e:
                    st.error(f"❌ Connection test failed: {str(e)}")
    
    with col2:
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
                headers = auth_manager.get_auth_headers()
                
                # Use streaming endpoint
                response = requests.post(
                    f"{API_URL}/api/chat/ask-stream",
                    json={
                        "course_id": st.session_state.current_course,
                        "question": question,
                        "use_eli12": use_eli12
                    },
                    headers=headers,
                    stream=True,
                    timeout=180  # Increased timeout for longer responses
                )
                
                if response.status_code == 200:
                    # Process streaming response
                    try:
                        response_received = False
                        for line in response.iter_lines(decode_unicode=True):
                            if line and line.strip():
                                response_received = True
                                if line.startswith('data: '):
                                    try:
                                        data = json.loads(line[6:])  # Remove 'data: ' prefix
                                        
                                        if data['type'] == 'metadata':
                                            sources = data.get('sources', [])
                                            # Show query analysis info
                                            query_info = data.get('query_info', {})
                                            if query_info.get('is_page_query') or query_info.get('is_exercise_query'):
                                                page_info = f"Page {query_info.get('page_number')}" if query_info.get('page_number') else ""
                                                exercise_info = f"Section {query_info.get('exercise_number')}" if query_info.get('exercise_number') else ""
                                                info_parts = [p for p in [page_info, exercise_info] if p]
                                                if info_parts:
                                                    st.info(f"🎯 Detected query about: {', '.join(info_parts)}")
                                        
                                        elif data['type'] == 'content':
                                            full_response += data['text']
                                            # Update the message with cursor
                                            message_placeholder.markdown(full_response + "▌")
                                        
                                        elif data['type'] == 'done':
                                            # Remove cursor and show final message
                                            message_placeholder.markdown(full_response)
                                            if sources:
                                                sources_placeholder.caption(f"📄 Sources: {', '.join(sources)}")
                                            break
                                        
                                        elif data['type'] == 'error':
                                            st.error(f"Error: {data['message']}")
                                            break
                                    
                                    except json.JSONDecodeError as e:
                                        st.warning(f"Failed to parse response line: {line[:100]}...")
                                        continue
                        
                        # Check if we received any response at all
                        if not response_received:
                            st.error("❌ No response received from server. The connection may have been closed immediately.")
                            st.info("💡 This might happen if:")
                            st.info("- The backend is not running properly")
                            st.info("- Ollama service is not responding")
                            st.info("- There's a network connectivity issue")
                            return
                    
                    except requests.exceptions.ChunkedEncodingError:
                        # Handle premature connection close
                        if full_response:
                            message_placeholder.markdown(full_response)
                            if sources:
                                sources_placeholder.caption(f"📄 Sources: {', '.join(sources)}")
                            st.warning("⚠️ Response was cut short due to connection issues, but partial answer is shown above.")
                        else:
                            st.error("❌ Connection was lost before receiving any response.")
                            st.info("💡 Try:")
                            st.info("- Refreshing the page")
                            st.info("- Checking if the backend is running")
                            st.info("- Verifying Ollama is running: `ollama serve`")
                            return
                    
                    # Add to chat history if we got any response
                    if full_response:
                        st.session_state.chat_history.append({
                            "role": "assistant",
                            "content": full_response,
                            "sources": sources
                        })
                else:
                    st.error(f"Failed to get response: {response.status_code}")
                    if response.status_code == 401:
                        st.error("Authentication failed. Please refresh the page and log in again.")
                    elif response.status_code == 500:
                        st.error("Server error. Please try again or contact support.")
                        try:
                            error_detail = response.json().get("detail", "Unknown server error")
                            st.error(f"Details: {error_detail}")
                        except:
                            pass
                    
            except requests.exceptions.ConnectionError:
                st.error("❌ Cannot connect to backend. Make sure it's running on http://localhost:8000")
            except requests.exceptions.Timeout:
                st.error("❌ Request timed out. The AI might be processing a complex question.")
            except requests.exceptions.ChunkedEncodingError:
                # Handle this at the top level too
                if full_response:
                    message_placeholder.markdown(full_response)
                    if sources:
                        sources_placeholder.caption(f"📄 Sources: {', '.join(sources)}")
                    st.warning("⚠️ Response was cut short, but partial answer is shown above.")
                    # Still add to chat history
                    st.session_state.chat_history.append({
                        "role": "assistant",
                        "content": full_response,
                        "sources": sources
                    })
                else:
                    st.error("❌ Connection was lost before receiving any response.")
            except Exception as e:
                st.error(f"Unexpected error: {str(e)}")
                import traceback
                st.error(traceback.format_exc())

