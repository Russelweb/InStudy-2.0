import streamlit as st
import plotly.graph_objects as go
import plotly.express as px
import pandas as pd
import requests
import os
from datetime import datetime, timedelta
from utils.auth_utils import auth_manager
import numpy as np

API_URL = os.getenv("API_URL", "http://localhost:8000")

def create_study_hours_chart(stats):
    """Create a beautiful study hours progress chart"""
    # Generate sample data for demonstration (in real app, this would come from activity logs)
    dates = pd.date_range(start=datetime.now() - timedelta(days=30), end=datetime.now(), freq='D')
    
    # Simulate study hours data with some realistic patterns
    np.random.seed(42)  # For consistent demo data
    base_hours = np.random.normal(2, 0.8, len(dates))
    base_hours = np.maximum(base_hours, 0)  # No negative hours
    
    # Add weekend patterns (more study on weekends)
    weekend_boost = [1.5 if date.weekday() >= 5 else 1.0 for date in dates]
    study_hours = base_hours * weekend_boost
    
    # Add cumulative hours
    cumulative_hours = np.cumsum(study_hours)
    
    df = pd.DataFrame({
        'Date': dates,
        'Daily Hours': study_hours,
        'Cumulative Hours': cumulative_hours
    })
    
    # Create subplot with secondary y-axis
    fig = go.Figure()
    
    # Daily hours bar chart
    fig.add_trace(go.Bar(
        x=df['Date'],
        y=df['Daily Hours'],
        name='Daily Study Hours',
        marker_color='rgba(55, 126, 184, 0.7)',
        hovertemplate='<b>%{x}</b><br>Study Hours: %{y:.1f}<extra></extra>'
    ))
    
    # Cumulative hours line
    fig.add_trace(go.Scatter(
        x=df['Date'],
        y=df['Cumulative Hours'],
        mode='lines+markers',
        name='Cumulative Hours',
        line=dict(color='rgba(255, 127, 14, 1)', width=3),
        marker=dict(size=6),
        yaxis='y2',
        hovertemplate='<b>%{x}</b><br>Total Hours: %{y:.1f}<extra></extra>'
    ))
    
    fig.update_layout(
        title='📈 Study Progress Over Time',
        xaxis_title='Date',
        yaxis=dict(title='Daily Hours', side='left'),
        yaxis2=dict(title='Cumulative Hours', side='right', overlaying='y'),
        hovermode='x unified',
        showlegend=True,
        height=400,
        plot_bgcolor='rgba(0,0,0,0)',
        paper_bgcolor='rgba(0,0,0,0)'
    )
    
    return fig

def create_activity_heatmap(stats):
    """Create an activity heatmap showing study patterns"""
    # Generate sample activity data
    dates = pd.date_range(start=datetime.now() - timedelta(days=30), end=datetime.now(), freq='D')
    
    # Create activity matrix (hour of day vs day)
    activity_data = []
    for date in dates:
        for hour in range(24):
            # Simulate activity patterns (more activity during study hours)
            if 8 <= hour <= 22:  # Study hours
                activity = np.random.poisson(2) if np.random.random() > 0.3 else 0
            else:
                activity = np.random.poisson(0.5) if np.random.random() > 0.8 else 0
            
            activity_data.append({
                'Date': date.strftime('%Y-%m-%d'),
                'Hour': hour,
                'Activity': activity,
                'Day': date.strftime('%a')
            })
    
    df = pd.DataFrame(activity_data)
    
    # Create pivot table for heatmap
    pivot_df = df.pivot_table(values='Activity', index='Hour', columns='Date', fill_value=0)
    
    fig = go.Figure(data=go.Heatmap(
        z=pivot_df.values,
        x=pivot_df.columns,
        y=pivot_df.index,
        colorscale='Blues',
        hovertemplate='<b>%{x}</b><br>Hour: %{y}:00<br>Activity: %{z}<extra></extra>'
    ))
    
    fig.update_layout(
        title='🔥 Study Activity Heatmap',
        xaxis_title='Date',
        yaxis_title='Hour of Day',
        height=300,
        plot_bgcolor='rgba(0,0,0,0)',
        paper_bgcolor='rgba(0,0,0,0)'
    )
    
    return fig

def create_performance_radar(stats):
    """Create a radar chart showing performance across different areas"""
    categories = ['Quiz Scores', 'Study Hours', 'Documents Read', 'Questions Asked', 'Consistency']
    
    # Normalize stats to 0-100 scale for radar chart
    values = [
        min(stats.get('quizzes_taken', 0) * 10, 100),  # Quiz performance
        min(stats.get('study_hours', 0) * 5, 100),     # Study hours
        min(stats.get('total_documents', 0) * 20, 100), # Documents
        min(len(stats.get('recent_questions', [])) * 5, 100), # Questions
        min(stats.get('study_hours', 0) * 3, 100)      # Consistency (simplified)
    ]
    
    fig = go.Figure()
    
    fig.add_trace(go.Scatterpolar(
        r=values,
        theta=categories,
        fill='toself',
        name='Your Performance',
        line_color='rgba(55, 126, 184, 1)',
        fillcolor='rgba(55, 126, 184, 0.3)'
    ))
    
    fig.update_layout(
        polar=dict(
            radialaxis=dict(
                visible=True,
                range=[0, 100]
            )),
        title='🎯 Performance Overview',
        height=400,
        plot_bgcolor='rgba(0,0,0,0)',
        paper_bgcolor='rgba(0,0,0,0)'
    )
    
    return fig

def create_course_distribution_pie(stats):
    """Create a pie chart showing document distribution across courses"""
    courses = stats.get('courses', [])
    
    if not courses:
        return None
    
    course_names = [course['name'] for course in courses]
    doc_counts = [course['document_count'] for course in courses]
    
    fig = go.Figure(data=[go.Pie(
        labels=course_names,
        values=doc_counts,
        hole=0.4,
        hovertemplate='<b>%{label}</b><br>Documents: %{value}<br>Percentage: %{percent}<extra></extra>'
    )])
    
    fig.update_layout(
        title='📚 Document Distribution by Course',
        height=400,
        plot_bgcolor='rgba(0,0,0,0)',
        paper_bgcolor='rgba(0,0,0,0)'
    )
    
    return fig

def show():
    st.title("📊 Dashboard")
    
    user_id = st.session_state.user_id
    
    # Fetch real stats with authentication
    try:
        headers = auth_manager.get_auth_headers()
        response = requests.get(f"{API_URL}/api/stats/stats", headers=headers)
        if response.status_code == 200:
            stats = response.json()
        else:
            stats = {
                "total_documents": 0,
                "total_courses": 0,
                "recent_questions": [],
                "study_hours": 0,
                "quizzes_taken": 0
            }
    except:
        st.error("Could not fetch stats. Make sure backend is running.")
        stats = {
            "total_documents": 0,
            "total_courses": 0,
            "recent_questions": [],
            "study_hours": 0,
            "quizzes_taken": 0
        }
    
    # Enhanced Stats Cards
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric(
            "📄 Documents", 
            stats["total_documents"],
            delta=f"+{stats['total_documents']} this month" if stats["total_documents"] > 0 else None
        )
    with col2:
        st.metric(
            "📚 Courses", 
            stats["total_courses"],
            delta=f"+{stats['total_courses']} active" if stats["total_courses"] > 0 else None
        )
    with col3:
        st.metric(
            "⏰ Study Hours", 
            f"{stats['study_hours']:.1f}",
            delta=f"+{stats['study_hours']:.1f}h total" if stats["study_hours"] > 0 else None
        )
    with col4:
        st.metric(
            "🎯 Quizzes", 
            stats["quizzes_taken"],
            delta=f"{stats['quizzes_taken']} completed" if stats["quizzes_taken"] > 0 else None
        )
    
    st.divider()
    
    # Charts Section
    if stats["total_documents"] > 0 or stats["study_hours"] > 0:
        # Row 1: Study Progress and Activity Heatmap
        col1, col2 = st.columns([2, 1])
        
        with col1:
            study_chart = create_study_hours_chart(stats)
            st.plotly_chart(study_chart, use_container_width=True)
        
        with col2:
            performance_radar = create_performance_radar(stats)
            st.plotly_chart(performance_radar, use_container_width=True)
        
        # Row 2: Activity Heatmap and Course Distribution
        col1, col2 = st.columns([2, 1])
        
        with col1:
            activity_heatmap = create_activity_heatmap(stats)
            st.plotly_chart(activity_heatmap, use_container_width=True)
        
        with col2:
            if stats.get("courses"):
                course_pie = create_course_distribution_pie(stats)
                if course_pie:
                    st.plotly_chart(course_pie, use_container_width=True)
            else:
                st.info("📈 Charts will appear here once you start studying!")
    
    st.divider()
    
    # Recent activity section (enhanced)
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("💬 Recent Questions")
        if stats["recent_questions"]:
            for i, q in enumerate(reversed(stats["recent_questions"][-5:])):  # Last 5
                with st.container():
                    # Add some styling with colored backgrounds
                    bg_colors = ["info", "success", "warning", "error"]
                    bg_color = bg_colors[i % len(bg_colors)]
                    
                    if bg_color == "info":
                        st.info(f"**{q.get('course', 'Unknown')}**: {q.get('question', 'N/A')}")
                    elif bg_color == "success":
                        st.success(f"**{q.get('course', 'Unknown')}**: {q.get('question', 'N/A')}")
                    elif bg_color == "warning":
                        st.warning(f"**{q.get('course', 'Unknown')}**: {q.get('question', 'N/A')}")
                    
                    st.caption(f"⏰ {q.get('timestamp', 'Unknown')[:10]}")
        else:
            st.caption("No questions asked yet. Go to AI Tutor to start! 🤖")
    
    with col2:
        st.subheader("📚 Your Courses")
        if stats.get("courses"):
            for i, course in enumerate(stats["courses"][:5]):  # Show first 5
                with st.container():
                    # Progress bar based on document count
                    progress = min(course['document_count'] / 10, 1.0)  # Max 10 docs = 100%
                    
                    st.markdown(f"**{course['name']}**")
                    st.progress(progress)
                    st.caption(f"📄 {course['document_count']} documents • {progress*100:.0f}% complete")
                    st.divider()
        else:
            st.caption("No courses yet. Go to Courses to create one! 📖")
    
    # Study streak and achievements section
    st.divider()
    st.subheader("🏆 Achievements & Streaks")
    
    achievement_cols = st.columns(4)
    
    with achievement_cols[0]:
        if stats["total_documents"] >= 5:
            st.success("📚 Document Master\n5+ documents uploaded!")
        else:
            st.info(f"📚 Upload {5 - stats['total_documents']} more documents")
    
    with achievement_cols[1]:
        if stats["quizzes_taken"] >= 3:
            st.success("🎯 Quiz Champion\n3+ quizzes completed!")
        else:
            st.info(f"🎯 Complete {3 - stats['quizzes_taken']} more quizzes")
    
    with achievement_cols[2]:
        if stats["study_hours"] >= 10:
            st.success("⏰ Study Warrior\n10+ hours studied!")
        else:
            st.info(f"⏰ Study {10 - stats['study_hours']:.1f} more hours")
    
    with achievement_cols[3]:
        if len(stats.get("recent_questions", [])) >= 10:
            st.success("💬 Curious Mind\n10+ questions asked!")
        else:
            remaining = 10 - len(stats.get("recent_questions", []))
            st.info(f"💬 Ask {remaining} more questions")
