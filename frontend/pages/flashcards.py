import streamlit as st
import requests
import os
from utils.auth_utils import auth_manager
from utils.ui_utils import run_with_dynamic_progress
from components.document_viewer import show_document_panel

API_URL = os.getenv("API_URL", "http://localhost:8000")

def _generate_flashcards_api(course_id, num_cards, include_images, explanation_level, headers):
    try:
        response = requests.post(
            f"{API_URL}/api/flashcards/generate",
            json={
                "course_id": course_id,
                "num_cards": num_cards,
                "include_images": include_images,
                "explanation_level": explanation_level
            },
            headers=headers,
            timeout=300
        )
        if response.status_code == 200:
            return response.json()
        return None
    except Exception as e:
        raise e

def show():
    # Page Styling
    st.markdown("""
    <style>
    .flashcard-main {
        background: rgba(21, 30, 46, 0.4);
        backdrop-filter: blur(15px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 32px;
        padding: 3rem;
        min-height: 400px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
        position: relative;
        box-shadow: 0 30px 60px rgba(0,0,0,0.4);
        margin: 2rem 0;
    }
    .card-label {
        position: absolute;
        top: 2rem;
        left: 2rem;
        color: rgba(255, 255, 255, 0.3);
        font-weight: 700;
        letter-spacing: 2px;
        font-size: 0.8rem;
    }
    .card-content {
        font-size: 1.8rem;
        font-weight: 600;
        line-height: 1.4;
        color: white;
    }
    .card-footer {
        position: absolute;
        bottom: 2rem;
        right: 2rem;
        color: #FF7F50;
        font-weight: 600;
    }
    </style>
    """, unsafe_allow_html=True)

    st.title("🗂️ Flashcard Generator")
    
    if not st.session_state.current_course:
        st.warning("Please select a course first")
        return
        
    show_document_panel("flashcards")
    
    # Setup Section (Card-like)
    with st.expander("🛠️ Deck Settings", expanded=not bool(st.session_state.get("flashcards"))):
        col1, col2, col3 = st.columns([1, 1, 1])
        with col1:
            num_cards = st.select_slider("Cards", options=[5, 10, 15, 20, 25], value=5)
        with col2:
            include_images = st.toggle("Include Visuals", value=True)
        with col3:
            explanation_level = st.selectbox("Depth", ["brief", "detailed", "comprehensive"], index=1)
            
        if st.button("🔥 Generate New Deck", use_container_width=True):
            messages = ["Scanning materials...", "Extracting concepts...", "Generating visuals...", "Finalizing deck..."]
            headers = auth_manager.get_auth_headers()
            args = (st.session_state.current_course, num_cards, include_images, explanation_level, headers)
            result, error = run_with_dynamic_progress(_generate_flashcards_api, args=args, messages=messages, estimated_time=45.0)
            
            if result:
                st.session_state.flashcards = result["flashcards"]
                st.session_state.current_card = 0
                st.session_state.show_back = False
                st.rerun()

    # Flashcard Display
    if "flashcards" in st.session_state and st.session_state.flashcards:
        cards = st.session_state.flashcards
        idx = st.session_state.get("current_card", 0)
        current_card = cards[idx]
        show_back = st.session_state.get("show_back", False)
        
        # Main Card UI
        st.markdown(f"""
        <div class="flashcard-main">
            <div class="card-label">CARD {idx + 1} / {len(cards)}</div>
            <div class="card-content">
                {current_card['back'] if show_back else current_card['front']}
            </div>
            <div class="card-footer">
                {'ANSWER' if show_back else 'QUESTION'}
            </div>
        </div>
        """, unsafe_allow_html=True)
        
        # Progress
        progress = (idx + 1) / len(cards)
        st.progress(progress)
        
        # Controls
        c1, c2, c3, c4 = st.columns([1, 2, 1, 1])
        with c1:
            if st.button("⬅️ PREVIOUS", use_container_width=True) and idx > 0:
                st.session_state.current_card -= 1
                st.session_state.show_back = False
                st.rerun()
        with c2:
            if st.button("🔄 REVEAL / FLIP", use_container_width=True):
                st.session_state.show_back = not show_back
                st.rerun()
        with c3:
            if st.button("➡️ NEXT", use_container_width=True) and idx < len(cards) - 1:
                st.session_state.current_card += 1
                st.session_state.show_back = False
                st.rerun()
        with c4:
            if st.button("🔀 SHUFFLE", use_container_width=True):
                import random
                random.shuffle(st.session_state.flashcards)
                st.session_state.current_card = 0
                st.session_state.show_back = False
                st.rerun()
                
        # # Optional: Image display if present
        # img_url = current_card.get("image_url")
        # img_type = current_card.get("image_type")
        #
        # if img_url and img_type != "text_badge":
        #     if img_type == "emoji":
        #         st.markdown(f"<div style='text-align: center; font-size: 5rem; padding: 20px;'>{img_url}</div>", unsafe_allow_html=True)
        #     else:
        #         with st.expander("🖼️ View Associated Visual", expanded=False):
        #             try:
        #                 st.image(img_url, use_container_width=True, caption=current_card.get("alt_text", ""))
        #             except:
        #                 st.caption(f"Image could not be matches: {img_url}")
    else:
        st.info("No flashcards yet. Use the settings above to generate your first deck!")
