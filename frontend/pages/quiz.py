import streamlit as st
import requests
import os

API_URL = os.getenv("API_URL", "http://localhost:8000")

def show():
    st.title("❓ Quiz Generator")
    
    if not st.session_state.current_course:
        st.warning("Please select a course first")
        return
    
    st.info(f"Course: {st.session_state.current_course.replace('_', ' ').title()}")
    
    # Quiz settings
    col1, col2, col3 = st.columns(3)
    
    with col1:
        num_questions = st.selectbox("Questions", [5, 10, 15, 20], index=1)
    with col2:
        difficulty = st.selectbox("Difficulty", ["Easy", "Medium", "Hard"], index=1)
    with col3:
        quiz_type = st.selectbox("Type", ["Mixed", "Multiple Choice", "True/False", "Short Answer"])
    
    if st.button("🎯 Generate Quiz", use_container_width=True):
        # Create progress container
        progress_container = st.empty()
        status_container = st.empty()
        
        try:
            type_map = {
                "Mixed": "mixed",
                "Multiple Choice": "multiple_choice",
                "True/False": "true_false",
                "Short Answer": "short_answer"
            }
            
            # Show progress
            with progress_container:
                progress_bar = st.progress(0)
                with status_container:
                    st.info("🔍 Retrieving study materials...")
                
                progress_bar.progress(20)
                
                with status_container:
                    st.info("🧠 Analyzing content...")
                
                progress_bar.progress(40)
                
                with status_container:
                    st.info(f"✍️ Generating {num_questions} questions...")
            
            response = requests.post(
                f"{API_URL}/api/quiz/generate",
                json={
                    "user_id": st.session_state.user_id,
                    "course_id": st.session_state.current_course,
                    "num_questions": num_questions,
                    "difficulty": difficulty,
                    "quiz_type": type_map[quiz_type]
                },
                timeout=120
            )
            
            with progress_container:
                progress_bar.progress(80)
                with status_container:
                    st.info("✅ Validating questions...")
            
            if response.status_code == 200:
                with progress_container:
                    progress_bar.progress(100)
                    with status_container:
                        st.success("🎉 Quiz ready!")
                
                st.session_state.quiz_questions = response.json()["questions"]
                st.session_state.quiz_answers = {}
                
                # Clear progress after a moment
                import time
                time.sleep(1)
                progress_container.empty()
                status_container.empty()
                
                st.success(f"Quiz generated with {len(st.session_state.quiz_questions)} questions!")
                st.rerun()
            else:
                progress_container.empty()
                status_container.empty()
                st.error("Failed to generate quiz")
        except Exception as e:
            progress_container.empty()
            status_container.empty()
            st.error(f"Error: {str(e)}")
    
    st.divider()
    
    # Display quiz
    if "quiz_questions" in st.session_state:
        questions = st.session_state.quiz_questions
        
        for idx, q in enumerate(questions):
            st.subheader(f"Question {idx + 1}")
            st.write(q["question"])
            
            if q["type"] == "multiple_choice" and q.get("options"):
                answer = st.radio(
                    "Select answer:",
                    q["options"],
                    key=f"q_{idx}"
                )
                st.session_state.quiz_answers[idx] = answer
            
            elif q["type"] == "true_false":
                answer = st.radio(
                    "Select answer:",
                    ["True", "False"],
                    key=f"q_{idx}"
                )
                st.session_state.quiz_answers[idx] = answer
            
            else:
                answer = st.text_area("Your answer:", key=f"q_{idx}")
                st.session_state.quiz_answers[idx] = answer
            
            with st.expander("Show Answer & Explanation"):
                st.success(f"✅ Correct Answer: {q['correct_answer']}")
                st.info(f"💡 {q['explanation']}")
            
            st.divider()
        
        if st.button("📊 Submit Quiz"):
            score = sum(
                1 for idx, q in enumerate(questions)
                if st.session_state.quiz_answers.get(idx, "").strip().lower() 
                == q["correct_answer"].strip().lower()
            )
            st.success(f"Score: {score}/{len(questions)} ({score/len(questions)*100:.0f}%)")
