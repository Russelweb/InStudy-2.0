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

@st.cache_data(ttl=3600)
def generate_ai_briefing(stats_dict_str: str) -> str:
    try:
        import ast
        stats = ast.literal_eval(stats_dict_str)
        courses = stats.get("courses", [])
        if not courses:
            return "🔥 Intelligence Tip: Upload your first study document to establish your knowledge base and kickstart your Aura Momentum!"
        
        # Find best performing course
        top_course = max(courses, key=lambda x: x.get("mastery", 0))
        m_score = top_course.get("mastery", 0)
        
        if m_score > 70:
            return f"🔥 Intelligence Tip: Exceptional work on {top_course['name']} ({m_score}% mastery)! Consider taking advanced quizzes to truly stress-test your knowledge."
        else:
            return f"🔥 Intelligence Tip: Your focus on {top_course['name']} is building up! Generate a study plan to structure your upcoming sessions and boost your mastery."
    except Exception as e:
        return "Ready to accelerate your learning today? Let's dive in."

def create_activity_heatmap(df_all):
    if df_all.empty: return None
    now = datetime.now()
    # 7 days leading up to today, left to right
    dates = [(now - timedelta(days=i)).date() for i in range(6, -1, -1)]
    hours = []
    for d in dates:
        row = df_all[df_all["date"].dt.date == d]
        hours.append(row["hours"].iloc[0] if not row.empty else 0)
    z = np.array(hours).reshape(1, 7)
    x_labels = [d.strftime('%a') for d in dates] # Short day names (Mon, Tue, etc.)
    
    fig = go.Figure(data=go.Heatmap(
        z=z, x=x_labels,
        colorscale=[[0, "rgba(255,255,255,0.04)"], [1, PRIMARY_ACCENT]],
        zmin=0, zmax=4,
        showscale=False, xgap=5, ygap=5,
    ))
    fig.update_layout(
        height=90, margin=dict(l=0,r=0,t=0,b=25),
        paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
        xaxis=dict(visible=True, showgrid=False, zeroline=False, side="bottom",
                   tickfont=dict(color="rgba(255,255,255,0.5)", size=11)),
        yaxis=dict(visible=False),
    )
    return fig

def show():
    st.markdown("""
    <style>
    .fintech-card {
        background: rgba(255, 255, 255, 0.03) !important;
        backdrop-filter: blur(15px) !important;
        -webkit-backdrop-filter: blur(15px) !important;
        border: 1px solid rgba(255, 255, 255, 0.06) !important;
        border-radius: 24px;
        padding: 1.5rem;
        margin-bottom: 1.5rem;
    }
    .stat-label {
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.4);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 1.5px;
    }
    .stat-value {
        font-size: 2.2rem;
        font-weight: 800;
        color: white;
        margin: 0.2rem 0;
    }
    .stat-delta {
        font-size: 0.8rem;
        color: #FF7F50;
        font-weight: 600;
    }
    </style>
    """, unsafe_allow_html=True)

    # Core Data Setup
    headers = auth_manager.get_auth_headers()
    stats = get_dashboard_stats(headers)
    df_all = _build_monthly_df(stats.get("daily_activity", {}))
    
    # Global Period Selection
    col_sel, _ = st.columns([1, 2])
    with col_sel:
        period = st.selectbox("Timeline Filter", ["This Month", "Last 3 Months", "All Time"], index=0, label_visibility="collapsed", key="global_period")
    
    period_hours = round(df_all["hours"].sum(), 1) if not df_all.empty else 0.0

    # Row 1: Greeting & Momentum
    col_greet, col_momentum = st.columns([2, 1])
    with col_greet:
        st.markdown(f"<h1 style='margin:0;'>Welcome back, {st.session_state.user_id}!</h1>", unsafe_allow_html=True)
        briefing = generate_ai_briefing(str(stats))
        st.markdown(f"<div style='background:rgba(255, 127, 80, 0.1); border-left:3px solid #FF7F50; padding:10px 15px; border-radius:12px; margin-top:1rem; font-size:0.95rem; color:white;'>{briefing}</div>", unsafe_allow_html=True)
    with col_momentum:
        st.markdown("<p style='color:rgba(255,255,255,0.4); font-size:0.7rem; text-transform:uppercase; margin-bottom:5px; margin-left:10px;'>Aura Momentum</p>", unsafe_allow_html=True)
        heatmap = create_activity_heatmap(df_all)
        if heatmap: st.plotly_chart(heatmap, config={'displayModeBar': False}, use_container_width=True)

    st.markdown("<br>", unsafe_allow_html=True)

    # Row 2: Metrics
    m_cols = st.columns(4)
    metrics = [
        ("Knowledge Base", stats.get("total_documents", 0), "Documents"),
        ("Active Paths", stats.get("total_courses", 0), "Courses"),
        ("Focus Time", f"{period_hours}h", "Total Study"),
        ("Engagements", stats.get("quizzes_taken", 0), "Quizzes")
    ]
    for col, (label, val, delta) in zip(m_cols, metrics):
        with col:
            st.markdown(f'<div class="fintech-card"><div class="stat-label">{label}</div><div class="stat-value">{val}</div><div class="stat-delta">{delta}</div></div>', unsafe_allow_html=True)

    # Row 3: Charts
    c1, c2 = st.columns([2, 1])
    with c1:
        st.markdown('<div class="fintech-card"><b>Study Velocity</b>', unsafe_allow_html=True)
        st.plotly_chart(create_study_hours_chart(df_all, period), use_container_width=True)
        st.markdown('</div>', unsafe_allow_html=True)
    with c2:
        st.markdown('<div class="fintech-card">', unsafe_allow_html=True)
        mastery = create_course_mastery(stats)
        if mastery: st.plotly_chart(mastery, use_container_width=True)
        else: st.info("Start studying to see mastery metrics.")
        st.markdown('</div>', unsafe_allow_html=True)

    # Row 4: Activity Feed
    a1, a2 = st.columns(2)
    with a1:
        st.subheader("Recent Questions")
        for q in reversed(stats.get("recent_questions", [])[-4:]):
            st.markdown(f"<div style='background:rgba(255,255,255,0.02); padding:1rem; border-radius:16px; margin-bottom:0.8rem; border:1px solid rgba(255,255,255,0.05);'><div style='color:#FF7F50; font-size:0.8rem; font-weight:700;'>{q.get('course', 'UNSPECIFIED')}</div><div>{q.get('question', '...')}</div></div>", unsafe_allow_html=True)
    with a2:
        st.subheader("Your Progress")
        for course in stats.get("courses", [])[:4]:
            m = course.get("mastery", 0)
            st.markdown(f"<div style='background:rgba(255,255,255,0.02); padding:1rem; border-radius:16px; margin-bottom:0.8rem; border:1px solid rgba(255,255,255,0.04);'><div style='display:flex; justify-content:space-between; font-weight:700;'><span>{course['name']}</span><span>{m}%</span></div><div style='background:rgba(255,255,255,0.05); height:6px; border-radius:10px; margin-top:10px;'><div style='background:#FF7F50; height:100%; border-radius:10px; width:{m}%;'></div></div></div>", unsafe_allow_html=True)
