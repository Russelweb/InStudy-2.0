import streamlit as st
import requests
import os
import json
from utils.auth_utils import auth_manager
from utils.api_utils import get_courses
from components.document_viewer import show_document_panel

API_URL = os.getenv("API_URL", "http://localhost:8000")

def show():
    # Fintech Styling for Chat
    st.markdown("""
    <style>
    /* Chat Container Tweaks */
    [data-testid="stChatMessage"] {
        background: rgba(255, 255, 255, 0.03) !important;
        border: 1px solid rgba(255, 255, 255, 0.05) !important;
        border-radius: 20px !important;
        padding: 1rem !important;
        margin-bottom: 1rem !important;
    }
    
    [data-testid="stChatMessage"]:has([data-testid="stChatMessageContent"]):nth-child(even) {
        background: rgba(255, 127, 80, 0.05) !important;
        border: 1px solid rgba(255, 127, 80, 0.1) !important;
    }

    .tutor-header {
        background: linear-gradient(90deg, rgba(255, 127, 80, 0.1) 0%, rgba(255, 99, 71, 0.1) 100%);
        border-radius: 24px;
        padding: 2rem;
        border: 1px solid rgba(255, 127, 80, 0.2);
        margin-bottom: 2rem;
        text-align: center;
    }

    .doc-card {
        background: rgba(255, 255, 255, 0.03);
        border-radius: 12px;
        padding: 0.8rem;
        margin-bottom: 0.5rem;
        border: 1px solid rgba(255, 255, 255, 0.05);
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    /* Memory pill */
    .memory-pill {
        background: rgba(129, 140, 248, 0.1);
        color: #818CF8;
        padding: 2px 10px;
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: 600;
        border: 1px solid rgba(129, 140, 248, 0.2);
    }
    /* File Uploader styling */
    [data-testid="stFileUploader"] {
        background: rgba(255, 255, 255, 0.02) !important;
        border: 1px dashed rgba(255, 127, 80, 0.3) !important;
        border-radius: 12px !important;
        padding: 10px !important;
    }
    </style>
    """, unsafe_allow_html=True)

    if not st.session_state.current_course:
        st.warning("Please select a course first from the Courses page")
        return
    
    # Hero Section
    st.markdown(f"""
    <div class="tutor-header">
        <h1 style='margin:0; color:#FF7F50;'>🤖 AI Study Tutor</h1>
        <p style='color:rgba(255,255,255,0.6); margin-top:0.5rem;'>Your personal intelligence for <b>{st.session_state.current_course.replace('_', ' ').title()}</b></p>
    </div>
    """, unsafe_allow_html=True)
    
    show_document_panel("ai_tutor")
    
    # Sidebar-like layout for tools
    col_chat, col_tools = st.columns([3, 1])
    
    with col_tools:
        st.markdown("<h4 style='font-size:1.1rem;'>📚 Materials</h4>", unsafe_allow_html=True)
        headers = auth_manager.get_auth_headers()
        courses = get_courses(headers)
        current_data = next((c for c in courses if c["id"] == st.session_state.current_course), None)
        
        if current_data and current_data.get("documents"):
            for doc in current_data["documents"]:
                st.markdown(f"""
                <div class="doc-card">
                    <span style='font-size:1.2rem;'>📄</span>
                    <span style='font-size:0.85rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;'>{doc}</span>
                </div>
                """, unsafe_allow_html=True)
        else:
            st.caption("No documents yet")
            
        with st.expander("📤 Upload Material"):
            uploaded_file = st.file_uploader("PDF, TXT, DOCX", type=["pdf", "txt", "docx"], label_visibility="collapsed")
            if uploaded_file and st.button("Process", use_container_width=True):
                with st.spinner("Analyzing..."):
                    try:
                        files = {"file": uploaded_file}
                        data = {"course_id": st.session_state.current_course}
                        response = requests.post(f"{API_URL}/api/documents/upload", files=files, data=data, headers=headers, timeout=300)
                        if response.status_code == 200:
                            st.success("Processed!")
                            st.rerun()
                        else:
                            st.error("Upload failed")
                    except Exception as e:
                        st.error(f"Error: {str(e)}")
            
        st.divider()
        
        st.markdown("<h4 style='font-size:1.1rem;'>🧠 Memory</h4>", unsafe_allow_html=True)
        if st.button("🗑️ Clear Context", use_container_width=True):
            try:
                response = requests.delete(f"{API_URL}/api/chat/memory/clear", params={"course_id": st.session_state.current_course}, headers=headers)
                if response.status_code == 200: st.rerun()
            except: pass
            
        use_eli12 = st.toggle("🎈 Simple Mode", help="ELI12 explanations")
        
        with st.expander("🛠️ System Tools"):
            if st.button("📡 Test Link"):
                resp = requests.post(f"{API_URL}/api/chat/health", headers=headers)
                st.toast("Connection Healthy" if resp.status_code == 200 else "Link Error")

    with col_chat:
        # 1. Chat Container for fixed space scrolling
        chat_container = st.container(height=500)
        
        with chat_container:
            for msg in st.session_state.chat_history:
                with st.chat_message(msg["role"]):
                    st.markdown(msg["content"])
                    if msg.get("sources"):
                        st.markdown(f"<p style='font-size:0.75rem; color:rgba(255,255,255,0.3);'>📄 Sources: {', '.join(msg['sources'])}</p>", unsafe_allow_html=True)
        
        # 2. Stop Button - Only shown when is_streaming is True
        if st.session_state.get("is_streaming", False):
            if st.button("⏹ Stop AI Tutor", type="primary", use_container_width=True):
                st.session_state.is_streaming = False
                st.session_state.pending_question = None
                st.rerun()

        # 3. Handle NEW questions
        if question := st.chat_input("Ask anything about your documents..."):
            st.session_state.pending_question = question
            st.session_state.is_streaming = True
            st.rerun()

        # 4. Handle STREAMING of pending question
        if st.session_state.get("pending_question") and st.session_state.get("is_streaming"):
            question = st.session_state.pending_question
            st.session_state.chat_history.append({"role": "user", "content": question})
            
            # Immediately show the user message in the container
            with chat_container:
                with st.chat_message("user"):
                    st.markdown(question)
                
                with st.chat_message("assistant"):
                    message_placeholder = st.empty()
                    sources_placeholder = st.empty()
                    full_response = ""
                    sources = []
                    
                    try:
                        response = requests.post(
                            f"{API_URL}/api/chat/ask-stream",
                            json={"course_id": st.session_state.current_course, "question": question, "use_eli12": use_eli12},
                            headers=headers,
                            stream=True,
                            timeout=300
                        )
                        
                        if response.status_code == 200:
                            for line in response.iter_lines(decode_unicode=True):
                                # The rerun from the Stop button will interrupt this loop
                                if line and line.startswith('data: '):
                                    data = json.loads(line[6:])
                                    if data['type'] == 'metadata':
                                        sources = data.get('sources', [])
                                    elif data['type'] == 'content':
                                        full_response += data['text']
                                        message_placeholder.markdown(full_response + "▌")
                                    elif data['type'] == 'done':
                                        message_placeholder.markdown(full_response)
                                        if sources:
                                            sources_placeholder.caption(f"📄 Sources: {', '.join(sources)}")
                                        break
                            
                            # Success: update history and clear state
                            st.session_state.chat_history.append({
                                "role": "assistant",
                                "content": full_response,
                                "sources": sources
                            })
                            st.session_state.is_streaming = False
                            st.session_state.pending_question = None
                            st.rerun()
                        else:
                            st.error("AI Error: Connection failed")
                            st.session_state.is_streaming = False
                            st.session_state.pending_question = None
                            
                    except Exception as e:
                        st.error(f"Error: {str(e)}")
                        st.session_state.is_streaming = False
                        st.session_state.pending_question = None
