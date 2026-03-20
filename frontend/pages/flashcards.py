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
    col1, col2, col3, col4 = st.columns([2, 1, 1, 1])
    with col1:
        num_cards = st.slider("Number of flashcards", 5, 20, 10)
    with col2:
        include_images = st.checkbox("Include Images", value=True, help="Add relevant images to flashcards")
    with col3:
        explanation_level = st.selectbox(
            "Explanation Level",
            ["brief", "detailed", "comprehensive"],
            index=1,  # Default to "detailed"
            help="• Brief: Concise answers (1-2 sentences)\n• Detailed: Educational explanations (3-4 sentences)\n• Comprehensive: In-depth explanations with examples (4-6 sentences)"
        )
    with col4:
        if st.button("🎴 Generate Flashcards", use_container_width=True):
            with st.spinner("Creating flashcards..."):
                try:
                    headers = auth_manager.get_auth_headers()
                    response = requests.post(
                        f"{API_URL}/api/flashcards/generate",
                        json={
                            "course_id": st.session_state.current_course,
                            "num_cards": num_cards,
                            "include_images": include_images,
                            "explanation_level": explanation_level
                        },
                        headers=headers
                    )
                    
                    if response.status_code == 200:
                        flashcards_data = response.json()["flashcards"]
                        st.session_state.flashcards = flashcards_data
                        st.session_state.current_card = 0
                        st.session_state.show_back = False
                        
                        # Count images more accurately
                        image_count = 0
                        for card in flashcards_data:
                            image_url = card.get("image_url", "")
                            image_type = card.get("image_type", "")
                            # Count all image types except text_badge
                            if (image_url and image_url.strip() and 
                                image_type and image_type != "text_badge"):
                                image_count += 1
                        
                        st.success(f"Generated {len(st.session_state.flashcards)} flashcards with {image_count} images! (Explanation level: {explanation_level})")
                        
                        # Debug info (can be removed later)
                        if image_count == 0 and include_images:
                            st.info("🔍 Debug: Images were requested but none found. Check backend logs.")
                            # Show first card's image data for debugging
                            if flashcards_data:
                                first_card = flashcards_data[0]
                                st.json({
                                    "image_url": first_card.get("image_url", "Missing"),
                                    "image_type": first_card.get("image_type", "Missing"),
                                    "alt_text": first_card.get("alt_text", "Missing")
                                })
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
        
        # Card display with image support
        card_container = st.container()
        with card_container:
            current_card = cards[idx]
            
            # Create columns for image and text
            if current_card.get("image_url") and current_card.get("image_type") != "text_badge":
                col_img, col_text = st.columns([1, 2])
                
                with col_img:
                    # Display image based on type
                    image_type = current_card.get("image_type", "")
                    image_url = current_card.get("image_url", "")
                    alt_text = current_card.get("alt_text", "")
                    
                    if image_type == "emoji":
                        # Display emoji directly
                        st.markdown(f"<div style='text-align: center; font-size: 4rem; padding: 20px;'>{image_url}</div>", unsafe_allow_html=True)
                    elif image_type in ["svg_image", "local_image"]:
                        # Display local SVG or image files
                        try:
                            # For local images, we need to serve them from the backend
                            if image_url.startswith("/static/"):
                                full_url = f"{API_URL}{image_url}"
                                st.image(full_url, width=200, caption=alt_text)
                            else:
                                st.image(image_url, width=200, caption=alt_text)
                        except Exception as e:
                            # Fallback to a default emoji if image fails to load
                            st.markdown("<div style='text-align: center; font-size: 3rem; padding: 20px;'>📚</div>", unsafe_allow_html=True)
                            st.caption(f"Image: {alt_text}")
                    elif image_type == "stock_photo":
                        try:
                            st.image(image_url, width=200, caption=alt_text)
                        except:
                            st.markdown("<div style='text-align: center; font-size: 3rem; padding: 20px;'>🖼️</div>", unsafe_allow_html=True)
                    else:
                        # Fallback to default study emoji
                        st.markdown("<div style='text-align: center; font-size: 3rem; padding: 20px;'>📚</div>", unsafe_allow_html=True)
                        if alt_text:
                            st.caption(alt_text)
                
                with col_text:
                    if st.session_state.get("show_back", False):
                        st.info(f"**Answer:**\n\n{current_card['back']}")
                    else:
                        st.success(f"**Question:**\n\n{current_card['front']}")
            else:
                # No image or text badge - show full width
                if st.session_state.get("show_back", False):
                    st.info(f"**Answer:**\n\n{current_card['back']}")
                else:
                    st.success(f"**Question:**\n\n{current_card['front']}")
                
                # Show text badge if available
                if current_card.get("image_type") == "text_badge":
                    badge_text = current_card["image_url"]  # Direct text, no data URL parsing
                    st.caption(f"💡 {badge_text}")
        
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
