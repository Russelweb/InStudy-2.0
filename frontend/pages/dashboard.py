import streamlit as st
import plotly.graph_objects as go
import plotly.express as px
import pandas as pd
import requests
import os
from datetime import datetime, timedelta
from utils.auth_utils import auth_manager
import numpy as np
from calendar import month_abbr
from utils.api_utils import get_dashboard_stats

API_URL = os.getenv("API_URL", "http://localhost:8000")

# Design constants
PRIMARY_ACCENT = "#FF7F50"  # Coral
SECONDARY_ACCENT = "#FF6347" # Orange Red
DARK_BG = "rgba(11, 17, 32, 0)" # Transparent for plotting on glass cards
GRID_COLOR = "rgba(255, 255, 255, 0.05)"
TEXT_COLOR = "rgba(255, 255, 255, 0.7)"

def _build_monthly_df(daily_activity: dict) -> pd.DataFrame:
    if not daily_activity:
        return pd.DataFrame()
    rows = []
    for date_str, day in daily_activity.items():
        try:
            dt = datetime.strptime(date_str[:10], "%Y-%m-%d")
        except ValueError:
            continue
        questions = int(day.get("questions", 0))
        explicit  = float(day.get("study_time", 0))
        hours     = explicit + questions * 5 / 60
        rows.append({
            "date":      dt,
            "label":     dt.strftime("%b %Y"),
            "hours":     hours,
            "questions": questions,
            "quizzes":   int(day.get("quizzes", 0)),
            "docs":      int(day.get("documents_uploaded", 0)),
        })
    if not rows:
        return pd.DataFrame()
    return pd.DataFrame(rows).sort_values("date").reset_index(drop=True)

def _filter_by_period(df: pd.DataFrame, period: str) -> pd.DataFrame:
    if df.empty:
        return df
    now = datetime.now()
    if period == "This Month":
        cutoff = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    elif period == "Last 3 Months":
        cutoff = (now - timedelta(days=90)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    elif period == "Last 6 Months":
        cutoff = (now - timedelta(days=180)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    else:  # All Time
        return df
    return df[df["date"] >= cutoff]

def _aggregate(df: pd.DataFrame):
    unique_months = df["label"].nunique()
    if unique_months <= 2:
        grp = df.groupby("date").agg(
            hours=("hours", "sum"),
            questions=("questions", "sum"),
            quizzes=("quizzes", "sum"),
            docs=("docs", "sum"),
        ).reset_index()
        grp = grp.sort_values("date")
        grp["x"] = grp["date"].dt.strftime("%d %b")
        line_shape = "spline"
        marker = dict(size=8, color=PRIMARY_ACCENT, line=dict(width=2, color="white"))
        mode = "lines+markers"
    else:
        grp = df.groupby("label").agg(
            hours=("hours", "sum"),
            questions=("questions", "sum"),
            quizzes=("quizzes", "sum"),
            docs=("docs", "sum"),
        ).reset_index()
        grp["sort_key"] = pd.to_datetime(grp["label"], format="%b %Y")
        grp = grp.sort_values("sort_key")
        grp["x"] = grp["label"]
        line_shape = "spline"
        marker = dict(size=6, color=PRIMARY_ACCENT)
        mode = "lines"
    return grp, line_shape, marker, mode

def apply_fintech_layout(fig, title):
    fig.update_layout(
        title=dict(text=f"<b>{title}</b>", font=dict(size=18, color="white")),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(color=TEXT_COLOR, family="Inter"),
        hovermode="x unified",
        margin=dict(l=10, r=10, t=60, b=10),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1, font=dict(size=10)),
        xaxis=dict(showgrid=False, zeroline=False, gridcolor=GRID_COLOR),
        yaxis=dict(showgrid=True, zeroline=False, gridcolor=GRID_COLOR, tickfont=dict(size=10)),
    )
    return fig

def create_study_hours_chart(df_filtered: pd.DataFrame, period: str):
    if df_filtered.empty:
        fig = go.Figure()
        fig.add_annotation(text="No data yet", xref="paper", yref="paper", x=0.5, y=0.5, showarrow=False, font=dict(color=TEXT_COLOR))
        return apply_fintech_layout(fig, "Study Hours")

    grp, line_shape, marker, mode = _aggregate(df_filtered)
    cumulative = grp["hours"].cumsum()
    
    fig = go.Figure()
    # Gradient area for hours
    fig.add_trace(go.Scatter(
        x=grp["x"], y=grp["hours"],
        mode=mode, name="Daily Hours",
        line=dict(color=PRIMARY_ACCENT, width=3, shape="spline"),
        fill="tozeroy",
        fillcolor="rgba(255, 127, 80, 0.1)",
        hovertemplate="%{y:.1f}h"
    ))
    # Glowing line for cumulative
    fig.add_trace(go.Scatter(
        x=grp["x"], y=cumulative,
        mode="lines", name="Cumulative",
        line=dict(color="#818CF8", width=2, dash="dot", shape="spline"),
        yaxis="y2",
        hovertemplate="%{y:.1f}h total"
    ))
    
    fig.update_layout(yaxis2=dict(overlaying="y", side="right", showgrid=False, zeroline=False))
    return apply_fintech_layout(fig, f"Study Velocity")

def create_course_mastery(stats):
    courses = stats.get("courses", [])
    if not courses: return None
    
    names, scores = [], []
    for c in courses[:6]:
        names.append(c["name"])
        scores.append(c.get("mastery", 0))
        
    fig = go.Figure(go.Bar(
        x=scores, y=names, orientation="h",
        marker=dict(
            color=scores,
            colorscale=[[0, "rgba(255, 127, 80, 0.2)"], [1, PRIMARY_ACCENT]],
            line=dict(width=0),
        ),
        text=[f"{s}%" for s in scores],
        textposition="inside",
        insidetextanchor="end",
        textfont=dict(color="white")
    ))
    
    fig.update_layout(xaxis=dict(range=[0, 105], visible=False))
    return apply_fintech_layout(fig, "Course Mastery")

def show():
    st.markdown("""
    <style>
    .dash-header {
        margin-bottom: 2rem;
    }
    .fintech-card {
        background: rgba(21, 30, 46, 0.4);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 24px;
        padding: 1.5rem;
        margin-bottom: 1.5rem;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    }
    .stat-label {
        font-size: 0.9rem;
        color: rgba(255, 255, 255, 0.5);
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 1px;
    }
    .stat-value {
        font-size: 2.2rem;
        font-weight: 800;
        color: #FF7F50;
        margin: 0.2rem 0;
    }
    .stat-delta {
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.4);
    }
    .recent-item {
        background: rgba(255, 255, 255, 0.03);
        border-radius: 16px;
        padding: 1rem;
        margin-bottom: 0.8rem;
        border: 1px solid rgba(255, 255, 255, 0.05);
        transition: transform 0.2s;
    }
    .recent-item:hover {
        transform: scale(1.02);
        background: rgba(255, 255, 255, 0.05);
    }
    </style>
    """, unsafe_allow_html=True)

    headers = auth_manager.get_auth_headers()
    stats = get_dashboard_stats(headers)

    # Scoped calculations
    df_all = _build_monthly_df(stats.get("daily_activity", {}))
    period_hours = round(df_all["hours"].sum(), 1) if not df_all.empty else 0.0

    # Header section
    col_t, col_p = st.columns([2, 1])
    with col_t:
        st.markdown(f"<h1 style='margin:0;'>Welcome back, {st.session_state.user_id}!</h1>", unsafe_allow_html=True)
        st.markdown("<p style='color:rgba(255,255,255,0.5);'>Here's your learning overview for today.</p>", unsafe_allow_html=True)
    with col_p:
        period = st.selectbox("Period", ["This Month", "Last 3 Months", "All Time"], index=0, label_visibility="collapsed")

    st.markdown("<br>", unsafe_allow_html=True)

    # Metric Cards
    m1, m2, m3, m4 = st.columns(4)
    metrics = [
        ("Knowledge Base", stats.get("total_documents", 0), "Documents"),
        ("Active Paths", stats.get("total_courses", 0), "Courses"),
        ("Focus Time", f"{period_hours}h", "Total Study"),
        ("Engagements", stats.get("quizzes_taken", 0), "Quizzes Completed")
    ]
    
    for col, (label, value, delta) in zip([m1, m2, m3, m4], metrics):
        with col:
            st.markdown(f"""
            <div class="fintech-card">
                <div class="stat-label">{label}</div>
                <div class="stat-value">{value}</div>
                <div class="stat-delta">{delta}</div>
            </div>
            """, unsafe_allow_html=True)

    # Charts Row
    c1, c2 = st.columns([2, 1])
    with c1:
        st.markdown('<div class="fintech-card">', unsafe_allow_html=True)
        st.plotly_chart(create_study_hours_chart(df_all, period), use_container_width=True)
        st.markdown('</div>', unsafe_allow_html=True)
    with c2:
        st.markdown('<div class="fintech-card">', unsafe_allow_html=True)
        # Mastery Chart
        mastery = create_course_mastery(stats)
        if mastery:
            st.plotly_chart(mastery, use_container_width=True)
        else:
            st.info("Start a course to see mastery metrics.")
        
        # New: Intelligence Insights (Context-aware progress)
        st.markdown("<h4 style='margin-top:2rem;'>🧠 Intelligence Insights</h4>", unsafe_allow_html=True)
        if stats.get("recent_questions"):
            # Simple concept extraction from recent questions
            concepts = set()
            for q in stats["recent_questions"]:
                # Naive extraction: capitalized words as proxy for concepts
                words = q.get("question", "").split()
                for w in words:
                    if len(w) > 4 and w[0].isupper(): concepts.add(w.strip("?.,!"))
            
            if concepts:
                cols = st.columns(min(len(concepts), 4))
                for i, concept in enumerate(list(concepts)[:4]):
                    with cols[i]:
                        st.markdown(f"""
                        <div style='background:rgba(129, 140, 248, 0.1); border:1px solid rgba(129, 140, 248, 0.2); 
                        padding:1rem; border-radius:16px; text-align:center;'>
                            <div style='color:#818CF8; font-size:0.7rem; font-weight:700;'>ACTIVE CONCEPT</div>
                            <div style='color:white; font-weight:600; margin-top:5px;'>{concept}</div>
                        </div>
                        """, unsafe_allow_html=True)
            else:
                st.caption("Ask your AI Tutor more questions to unlock concept-level insights.")
        else:
            st.caption("No recent activity to analyze concepts.")
        st.markdown('</div>', unsafe_allow_html=True)

    # Activity & Lists
    col_a, col_b = st.columns(2)
    with col_a:
        st.subheader("Recent Questions")
        questions = stats.get("recent_questions", [])
        if questions:
            for q in reversed(questions[-4:]):
                st.markdown(f"""
                <div class="recent-item">
                    <div style="color:#FF7F50; font-size:0.8rem; font-weight:bold; margin-bottom:0.2rem;">{q.get('course', 'UNSPECIFIED')}</div>
                    <div style="font-size:0.95rem;">{q.get('question', '...')}</div>
                    <div style="color:rgba(255,255,255,0.3); font-size:0.75rem; margin-top:0.4rem;">{q.get('timestamp', '')[:16].replace('T', ' ')}</div>
                </div>
                """, unsafe_allow_html=True)
        else:
            st.caption("No recent activity")

    with col_b:
        st.subheader("Your Progress")
        courses = stats.get("courses", [])
        if courses:
            for course in courses[:4]:
                mastery = course.get("mastery", 0)
                avg_quiz = course.get("avg_quiz_score")
                progress = mastery / 100
                st.markdown(f"""
                <div class="recent-item">
                    <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                        <span style="font-weight:bold;">{course['name']}</span>
                        <span style="color:#FF7F50; font-weight:bold;">{mastery}%</span>
                    </div>
                    <div style="background:rgba(255,255,255,0.05); border-radius:10px; height:8px;">
                        <div style="background:linear-gradient(90deg, #FF7F50 {mastery}%, transparent {mastery}%); height:100%; border-radius:10px;"></div>
                    </div>
                    {f'<div style="font-size:0.75rem; color:rgba(255,255,255,0.4); margin-top:0.4rem;">Avg. Quiz Score: {avg_quiz}%</div>' if avg_quiz else ''}
                </div>
                """, unsafe_allow_html=True)
        else:
            st.caption("No courses yet")

    # Achievements Footer
    st.markdown("<br>", unsafe_allow_html=True)
    with st.expander("🏆 Your Achievements", expanded=False):
        a1, a2, a3 = st.columns(3)
        ach_list = [
            ("Librarian", stats.get("total_documents", 0) >= 5),
            ("Scholar", stats.get("quizzes_taken", 0) >= 3),
            ("Philosopher", len(stats.get("recent_questions", [])) >= 10)
        ]
        for col, (name, earned) in zip([a1, a2, a3], ach_list):
            with col:
                st.markdown(f"""
                <div style="text-align:center; padding:1rem; border-radius:12px; background:{'rgba(255,127,80,0.1)' if earned else 'rgba(255,255,255,0.02)'}; border: 1px solid {'#FF7F50' if earned else 'rgba(255,255,255,0.05)'}">
                    <div style="font-size:1.5rem;">{'⭐' if earned else '🔒'}</div>
                    <div style="font-weight:bold; color:{'#FF7F50' if earned else 'rgba(255,255,255,0.3)'};">{name}</div>
                </div>
                """, unsafe_allow_html=True)
