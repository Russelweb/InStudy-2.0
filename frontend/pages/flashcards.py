import streamlit as st
import requests
import os
from utils.auth_utils import auth_manager

API_URL = os.getenv("API_URL", "http://localhost:8000")

def show():
    st.title("🗂️ Flashcards")
    
    if not st.session_state.current_course:
        st.warning("Please select a course first")
        return
    
    st.info(f"Course: {st.session_state.current_course.replace('_', ' ').title()}")
    
    # Generate flashcards
    col1, col2 = st.columns([3, 1])
    with col1:
        num_cards = st.slider("Number of flashcards", 5, 20, 10)
    with col2:
        if st.button("🎴 Generate Flashcards", use_container_width=True):
            with st.spinner("Creating flashcards..."):
                try:
                    headers = auth_manager.get_auth_headers()
                    response = requests.post(
                        f"{API_URL}/api/flashcards/generate",
                        json={
                            "course_id": st.session_state.current_course,
                            "num_cards": num_cards
                        },
                        headers=headers
                    )
                    
                    if response.status_code == 200:
                        st.session_state.flashcards = response.json()["flashcards"]
                        st.session_state.current_card = 0
                        st.session_state.show_back = False
                        st.success(f"Generated {len(st.session_state.flashcards)} flashcards!")
                    else:
                        st.error("Failed to generate flashcards")
                except Exception as e:
                    st.error(f"Error: {str(e)}")
    
    st.divider()
    
    # Display flashcards
    if "flashcards" in st.session_state and st.session_state.flashcards:
        cards = st.session_state.flashcards
        idx = st.session_state.get("current_card", 0)
        
        st.subheader(f"Card {idx + 1} of {len(cards)}")
        
        # Card display
        card_container = st.container()
        with card_container:
            if st.session_state.get("show_back", False):
                st.info(f"**Answer:**\n\n{cards[idx]['back']}")
            else:
                st.success(f"**Question:**\n\n{cards[idx]['front']}")
        
        # Controls
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            if st.button("⬅️ Previous") and idx > 0:
                st.session_state.current_card -= 1
                st.session_state.show_back = False
                st.rerun()
        
        with col2:
            if st.button("🔄 Flip Card"):
                st.session_state.show_back = not st.session_state.get("show_back", False)
                st.rerun()
        
        with col3:
            if st.button("➡️ Next") and idx < len(cards) - 1:
                st.session_state.current_card += 1
                st.session_state.show_back = False
                st.rerun()
        
        with col4:
            if st.button("🔀 Shuffle"):
                import random
                random.shuffle(st.session_state.flashcards)
                st.session_state.current_card = 0
                st.session_state.show_back = False
                st.rerun()
