import streamlit as st
import requests
import os
from utils.auth_utils import auth_manager
from utils.ui_utils import run_with_dynamic_progress
from components.document_viewer import show_document_panel

API_URL = os.getenv("API_URL", "http://localhost:8000")

def _generate_quiz_api(course_id, num_questions, difficulty, quiz_type, headers):
    type_map = {"Mixed": "mixed", "Multiple Choice": "multiple_choice", "True/False": "true_false", "Short Answer": "short_answer"}
    try:
        response = requests.post(
            f"{API_URL}/api/quiz/generate",
            json={"course_id": course_id, "num_questions": num_questions, "difficulty": difficulty.lower(), "quiz_type": type_map.get(quiz_type, "mixed")},
            headers=headers,
            timeout=300
        )
        return response.json() if response.status_code == 200 else None
    except Exception as e: raise e

def _evaluate_quiz_api(course_id, questions, answers, headers):
    try:
        response = requests.post(f"{API_URL}/api/quiz/evaluate", json={"course_id": course_id, "questions": questions, "user_answers": answers}, headers=headers, timeout=300)
        return response.json() if response.status_code == 200 else None
    except Exception as e: raise e

def show():
    st.markdown("""
    <style>
    .quiz-card {
        background: rgba(21, 30, 46, 0.4);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 20px;
        padding: 1.5rem;
        margin-bottom: 2rem;
    }
    .score-card {
        background: linear-gradient(135deg, rgba(255, 127, 80, 0.2) 0%, rgba(255, 99, 71, 0.2) 100%);
        border: 2px solid #FF7F50;
        border-radius: 24px;
        padding: 2.5rem;
        text-align: center;
        margin-bottom: 3rem;
    }
    .question-header {
        color: #FF7F50;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        font-size: 0.8rem;
        margin-bottom: 0.5rem;
    }
    </style>
    """, unsafe_allow_html=True)

    st.title("❓ Smart Quiz")
    if not st.session_state.current_course:
        st.warning("Select a course first")
        return
        
    show_document_panel("quiz")
    
    # Init State
    for key in ["quiz_state", "quiz_questions", "quiz_answers", "quiz_results"]:
        if key not in st.session_state: 
            st.session_state[key] = "setup" if key == "quiz_state" else ([] if key == "quiz_questions" else ({} if key == "quiz_answers" else None))
    
    if st.session_state.quiz_state == "setup":
        st.markdown('<div class="quiz-card">', unsafe_allow_html=True)
        st.subheader("Quiz Configuration")
        c1, c2, c3 = st.columns(3)
        with c1: num_questions = st.selectbox("Count", [5, 10, 15, 20], index=1)
        with c2: difficulty = st.selectbox("Level", ["Easy", "Medium", "Hard"], index=1)
        with c3: quiz_type = st.selectbox("Format", ["Mixed", "Multiple Choice", "True/False", "Short Answer"])
        
        if st.button("🚀 Begin Assessment", use_container_width=True):
            messages = ["Selecting topics...", "Generating questions...", "Finalizing quiz..."]
            headers = auth_manager.get_auth_headers()
            args = (st.session_state.current_course, num_questions, difficulty, quiz_type, headers)
            res, err = run_with_dynamic_progress(_generate_quiz_api, args=args, messages=messages, estimated_time=45.0)
            if res:
                st.session_state.quiz_questions = res["questions"]
                st.session_state.quiz_state = "taking"
                st.rerun()
        st.markdown('</div>', unsafe_allow_html=True)

    elif st.session_state.quiz_state == "taking":
        questions = st.session_state.quiz_questions
        answered = len([k for k in st.session_state.quiz_answers if st.session_state.quiz_answers[k].strip()])
        st.progress(answered / len(questions))
        
        for idx, q in enumerate(questions):
            st.markdown(f'<div class="quiz-card"><div class="question-header">Question {idx+1}</div>', unsafe_allow_html=True)
            st.write(f"**{q['question']}**")
            
            q_type = q.get("type", "multiple_choice")
            if q_type == "multiple_choice":
                ans = st.radio("Choose one:", q["options"], key=f"q_{idx}", index=None)
                if ans: st.session_state.quiz_answers[str(idx)] = ans
            elif q_type == "true_false":
                ans = st.radio("Verdict:", ["True", "False"], key=f"q_{idx}", index=None)
                if ans: st.session_state.quiz_answers[str(idx)] = ans
            else:
                ans = st.text_area("Your answer:", key=f"q_{idx}")
                if ans: st.session_state.quiz_answers[str(idx)] = ans
            st.markdown('</div>', unsafe_allow_html=True)
            
        col1, col2 = st.columns(2)
        with col1:
            if st.button("📊 Finalize & Submit", use_container_width=True, disabled=answered < len(questions)):
                headers = auth_manager.get_auth_headers()
                args = (st.session_state.current_course, st.session_state.quiz_questions, st.session_state.quiz_answers, headers)
                res, err = run_with_dynamic_progress(_evaluate_quiz_api, args=args, estimated_time=6.0)
                if res:
                    st.session_state.quiz_results = res
                    st.session_state.quiz_state = "completed"
                    st.rerun()
        with col2:
            if st.button("❌ Cancel & New Quiz", use_container_width=True):
                st.session_state.quiz_state = "setup"
                st.session_state.quiz_questions = []
                st.session_state.quiz_answers = {}
                st.rerun()

    elif st.session_state.quiz_state == "completed":
        res = st.session_state.quiz_results
        st.markdown(f"""
        <div class="score-card">
            <h4 style="color:rgba(255,255,255,0.6); margin-bottom:0;">PERFORMANCE SCORE</h4>
            <h1 style="font-size:5rem; color:#FF7F50; margin:0;">{res['score_percentage']}%</h1>
            <p style="font-size:1.2rem; color:white;">{res['correct_answers']} / {res['total_questions']} CORRECT</p>
        </div>
        """, unsafe_allow_html=True)
        
        for r in res["question_results"]:
            with st.expander(f"Question {r['question_number']} - {'✅' if r['is_correct'] else '❌'}"):
                st.markdown(f"**Question:** {r['question']}")
                st.markdown(f"**Your Answer:** {r['user_answer']}")
                st.markdown(f"**Correct Path:** {r['correct_answer']}")
                st.info(f"**Insight:** {r['explanation']}")
        
        if st.button("🔄 Restart New Session", use_container_width=True):
            st.session_state.quiz_state = "setup"
            st.session_state.quiz_questions = []
            st.session_state.quiz_answers = {}
            st.rerun()
