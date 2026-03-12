import streamlit as st
import requests
import os
from utils.auth_utils import auth_manager

API_URL = os.getenv("API_URL", "http://localhost:8000")

def show():
    st.title("❓ Quiz Generator")
    
    if not st.session_state.current_course:
        st.warning("Please select a course first")
        return
    
    st.info(f"Course: {st.session_state.current_course.replace('_', ' ').title()}")
    
    # Initialize session state for quiz flow
    if "quiz_state" not in st.session_state:
        st.session_state.quiz_state = "setup"  # setup, taking, completed
    if "quiz_questions" not in st.session_state:
        st.session_state.quiz_questions = []
    if "quiz_answers" not in st.session_state:
        st.session_state.quiz_answers = {}
    if "quiz_results" not in st.session_state:
        st.session_state.quiz_results = None
    
    # Quiz Setup Phase
    if st.session_state.quiz_state == "setup":
        show_quiz_setup()
    
    # Quiz Taking Phase
    elif st.session_state.quiz_state == "taking":
        show_quiz_taking()
    
    # Quiz Results Phase
    elif st.session_state.quiz_state == "completed":
        show_quiz_results()

def show_quiz_setup():
    """Show quiz generation settings"""
    st.subheader("📝 Quiz Settings")
    
    # Quiz settings
    col1, col2, col3 = st.columns(3)
    
    with col1:
        num_questions = st.selectbox("Questions", [5, 10, 15, 20], index=1)
    with col2:
        difficulty = st.selectbox("Difficulty", ["Easy", "Medium", "Hard"], index=1)
    with col3:
        quiz_type = st.selectbox("Type", ["Mixed", "Multiple Choice", "True/False", "Short Answer"])
    
    if st.button("🎯 Generate Quiz", use_container_width=True):
        with st.spinner("Creating quiz..."):
            try:
                type_map = {
                    "Mixed": "mixed",
                    "Multiple Choice": "multiple_choice",
                    "True/False": "true_false",
                    "Short Answer": "short_answer"
                }
                
                headers = auth_manager.get_auth_headers()
                response = requests.post(
                    f"{API_URL}/api/quiz/generate",
                    json={
                        "course_id": st.session_state.current_course,
                        "num_questions": num_questions,
                        "difficulty": difficulty.lower(),
                        "quiz_type": type_map[quiz_type]
                    },
                    headers=headers
                )
                
                if response.status_code == 200:
                    st.session_state.quiz_questions = response.json()["questions"]
                    st.session_state.quiz_answers = {}
                    st.session_state.quiz_results = None
                    st.session_state.quiz_state = "taking"
                    st.success(f"Quiz generated with {len(st.session_state.quiz_questions)} questions!")
                    st.rerun()
                else:
                    st.error("Failed to generate quiz")
            except Exception as e:
                st.error(f"Error: {str(e)}")

def show_quiz_taking():
    """Show quiz questions for answering"""
    st.subheader("📋 Take Quiz")
    
    questions = st.session_state.quiz_questions
    
    if not questions:
        st.error("No questions available")
        return
    
    # Progress indicator
    progress = len([k for k in st.session_state.quiz_answers.keys() if st.session_state.quiz_answers[k].strip()]) / len(questions)
    st.progress(progress, text=f"Progress: {int(progress * 100)}%")
    
    # Display questions
    for idx, q in enumerate(questions):
        st.markdown(f"### Question {idx + 1}")
        st.write(q["question"])
        
        question_type = q.get("type", "multiple_choice")
        
        if question_type == "multiple_choice" and q.get("options"):
            answer = st.radio(
                "Select your answer:",
                q["options"],
                key=f"q_{idx}",
                index=None
            )
            if answer:
                st.session_state.quiz_answers[str(idx)] = answer
        
        elif question_type == "true_false":
            answer = st.radio(
                "Select your answer:",
                ["True", "False"],
                key=f"q_{idx}",
                index=None
            )
            if answer:
                st.session_state.quiz_answers[str(idx)] = answer
        
        else:  # short_answer, structural
            answer = st.text_area(
                "Your answer:",
                key=f"q_{idx}",
                placeholder="Provide a detailed answer..."
            )
            if answer:
                st.session_state.quiz_answers[str(idx)] = answer
        
        st.divider()
    
    # Submit button
    col1, col2 = st.columns([1, 1])
    
    with col1:
        if st.button("🔄 Start Over", use_container_width=True):
            st.session_state.quiz_state = "setup"
            st.session_state.quiz_questions = []
            st.session_state.quiz_answers = {}
            st.session_state.quiz_results = None
            st.rerun()
    
    with col2:
        # Check if all questions are answered
        answered_count = len([k for k in st.session_state.quiz_answers.keys() if st.session_state.quiz_answers[k].strip()])
        
        if answered_count < len(questions):
            st.button(f"📊 Submit Quiz ({answered_count}/{len(questions)} answered)", disabled=True, use_container_width=True)
            st.warning(f"Please answer all questions before submitting. {len(questions) - answered_count} questions remaining.")
        else:
            if st.button("📊 Submit Quiz", use_container_width=True):
                submit_quiz()

def submit_quiz():
    """Submit quiz for evaluation"""
    with st.spinner("Evaluating your answers..."):
        try:
            headers = auth_manager.get_auth_headers()
            
            response = requests.post(
                f"{API_URL}/api/quiz/evaluate",
                json={
                    "questions": st.session_state.quiz_questions,
                    "user_answers": st.session_state.quiz_answers
                },
                headers=headers,
                timeout=60
            )
            
            if response.status_code == 200:
                st.session_state.quiz_results = response.json()
                st.session_state.quiz_state = "completed"
                st.success("Quiz evaluated successfully!")
                st.rerun()
            else:
                st.error(f"Failed to evaluate quiz - Status: {response.status_code}")
                try:
                    error_detail = response.json()
                    st.error(f"Error details: {error_detail.get('detail', 'Unknown error')}")
                except:
                    st.error(f"Response text: {response.text}")
                    
        except requests.exceptions.Timeout:
            st.error("⏱️ Request timed out. The evaluation is taking too long.")
        except requests.exceptions.ConnectionError:
            st.error("🔌 Cannot connect to the backend server.")
        except Exception as e:
            st.error(f"❌ Error evaluating quiz: {str(e)}")

def show_quiz_results():
    """Show quiz results with detailed feedback"""
    results = st.session_state.quiz_results
    
    if not results:
        st.error("No results available")
        return
    
    # Overall score
    st.subheader("🎯 Quiz Results")
    
    score_color = "green" if results["score_percentage"] >= 70 else "orange" if results["score_percentage"] >= 50 else "red"
    
    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric("Score", f"{results['score_percentage']}%")
    with col2:
        st.metric("Correct", f"{results['correct_answers']}/{results['total_questions']}")
    with col3:
        grade = "A" if results["score_percentage"] >= 90 else "B" if results["score_percentage"] >= 80 else "C" if results["score_percentage"] >= 70 else "D" if results["score_percentage"] >= 60 else "F"
        st.metric("Grade", grade)
    
    # Performance message
    if results["score_percentage"] >= 90:
        st.success("🌟 Excellent work! You have a strong understanding of the material.")
    elif results["score_percentage"] >= 70:
        st.success("👍 Good job! You understand most of the concepts well.")
    elif results["score_percentage"] >= 50:
        st.warning("📚 Not bad, but there's room for improvement. Review the explanations below.")
    else:
        st.error("📖 Consider reviewing the study material more thoroughly.")
    
    st.divider()
    
    # Detailed question results
    st.subheader("📋 Detailed Results")
    
    for result in results["question_results"]:
        with st.expander(f"Question {result['question_number']} - {'✅ Correct' if result['is_correct'] else '❌ Incorrect'}"):
            st.write(f"**Question:** {result['question']}")
            
            col1, col2 = st.columns(2)
            
            with col1:
                st.write(f"**Your Answer:**")
                if result['is_correct']:
                    st.success(result['user_answer'])
                else:
                    st.error(result['user_answer'])
            
            with col2:
                st.write(f"**Correct Answer:**")
                st.info(result['correct_answer'])
            
            st.write(f"**Explanation:**")
            st.write(result['explanation'])
            
            if result.get('feedback'):
                st.caption(f"Evaluation method: {result['feedback']}")
    
    # Action buttons
    col1, col2 = st.columns(2)
    
    with col1:
        if st.button("🔄 Take Another Quiz", use_container_width=True):
            st.session_state.quiz_state = "setup"
            st.session_state.quiz_questions = []
            st.session_state.quiz_answers = {}
            st.session_state.quiz_results = None
            st.rerun()
    
    with col2:
        if st.button("📚 Back to Dashboard", use_container_width=True):
            st.switch_page("pages/dashboard.py")
