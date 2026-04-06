import streamlit as st
import requests
import os
import pandas as pd
import plotly.express as px
from utils.auth_utils import auth_manager

API_URL = os.getenv("API_URL", "http://localhost:8000")

def _get_mastery_profile(course_id, headers):
    try:
        response = requests.get(f"{API_URL}/api/mastery/profile/{course_id}", headers=headers, timeout=10)
        if response.status_code == 200:
            return response.json().get("profile", [])
    except:
        pass
    return []

def show():
    # Page Styling
    st.markdown("""
    <style>
    .mastery-card {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 20px;
        padding: 1.5rem;
        margin-bottom: 1rem;
    }
    .stat-value {
        font-size: 2rem;
        font-weight: 800;
        color: white;
    }
    .stat-label {
        font-size: 0.9rem;
        color: rgba(255, 255, 255, 0.5);
        text-transform: uppercase;
        letter-spacing: 1px;
    }
    </style>
    """, unsafe_allow_html=True)
    
    st.title("🎯 Mastery Overview")
    
    if not st.session_state.get("current_course"):
        st.warning("Please select a course from the sidebar to view mastery.")
        return
        
    course_id = st.session_state.current_course
    headers = auth_manager.get_auth_headers()
    
    with st.spinner("Analyzing mastery profile..."):
        profile = _get_mastery_profile(course_id, headers)
        
    if not profile:
        st.info("No mastery data yet. Interact with smart flashcards or quizzes to build your profile!")
        return

    # Process Data
    df = pd.DataFrame(profile)
    df["status"] = df["familiarity_score"].map({-1: "Needs Review", 0: "Familiar", 1: "Mastered"})
    
    # High-level stats
    c1, c2, c3, c4 = st.columns(4)
    with c1:
        st.markdown(f'<div class="mastery-card"><div class="stat-value">{len(df)}</div><div class="stat-label">Total Concepts</div></div>', unsafe_allow_html=True)
    with c2:
        mastered = len(df[df["familiarity_score"] > 0])
        st.markdown(f'<div class="mastery-card"><div class="stat-value" style="color:#2ecc71;">{mastered}</div><div class="stat-label">Mastered</div></div>', unsafe_allow_html=True)
    with c3:
        familiar = len(df[df["familiarity_score"] == 0])
        st.markdown(f'<div class="mastery-card"><div class="stat-value" style="color:#f1c40f;">{familiar}</div><div class="stat-label">Familiar</div></div>', unsafe_allow_html=True)
    with c4:
        needs_review = len(df[df["familiarity_score"] < 0])
        st.markdown(f'<div class="mastery-card"><div class="stat-value" style="color:#e74c3c;">{needs_review}</div><div class="stat-label">Needs Review</div></div>', unsafe_allow_html=True)
        
    st.markdown("<br>", unsafe_allow_html=True)
    
    # Visualizations
    col1, col2 = st.columns([1, 1])
    
    with col1:
        st.markdown("<h4 style='color:#FF7F50;'>Distribution</h4>", unsafe_allow_html=True)
        # Pie chart
        pie_data = df.groupby("status").size().reset_index(name="count")
        color_map = {"Mastered": "#2ecc71", "Familiar": "#f1c40f", "Needs Review": "#e74c3c"}
        
        fig_pie = px.pie(pie_data, values="count", names="status", color="status", color_discrete_map=color_map, hole=0.6)
        fig_pie.update_layout(
            plot_bgcolor="rgba(0,0,0,0)",
            paper_bgcolor="rgba(0,0,0,0)",
            font=dict(color="white"),
            margin=dict(t=20, b=20, l=20, r=20),
            showlegend=False
        )
        st.plotly_chart(fig_pie, use_container_width=True)
        
    with col2:
        st.markdown("<h4 style='color:#FF7F50;'>Concept Trace</h4>", unsafe_allow_html=True)
        # Bar chart for concepts
        df_sorted = df.sort_values(by="familiarity_score", ascending=True).head(10) # Top 10 weakest/strongest
        
        fig_bar = px.bar(df_sorted, x="familiarity_score", y="concept_id", orientation="h", color="status", color_discrete_map=color_map)
        fig_bar.update_layout(
            plot_bgcolor="rgba(0,0,0,0)",
            paper_bgcolor="rgba(0,0,0,0)",
            font=dict(color="white"),
            xaxis=dict(title="Familiarity Score", tickvals=[-1, 0, 1], ticktext=["Review", "Learn", "Master"]),
            yaxis=dict(title=""),
            margin=dict(t=20, b=20, l=20, r=20),
            showlegend=False
        )
        st.plotly_chart(fig_bar, use_container_width=True)
