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

API_URL = os.getenv("API_URL", "http://localhost:8000")


def _build_monthly_df(daily_activity: dict) -> pd.DataFrame:
    """Aggregate daily_activity into per-day rows (grouping to monthly happens in chart functions)."""
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
    """Return (grouped_df, x_col, line_shape, marker) based on data spread."""
    unique_months = df["label"].nunique()
    if unique_months <= 2:
        # Daily granularity — group by actual date
        grp = df.groupby("date").agg(
            hours=("hours", "sum"),
            questions=("questions", "sum"),
            quizzes=("quizzes", "sum"),
            docs=("docs", "sum"),
        ).reset_index()
        grp = grp.sort_values("date")
        grp["x"] = grp["date"].dt.strftime("%d %b")
        line_shape = "linear" if len(grp) < 3 else "spline"
        marker = dict(size=7) if len(grp) <= 5 else dict(size=4)
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
        marker = dict(size=4)
        mode = "lines"
    return grp, line_shape, marker, mode


def create_study_hours_chart(df_filtered: pd.DataFrame, period: str):
    """
    Smooth dual-area chart:
    - Blue filled area  = daily/monthly study hours
    - Orange smooth line = cumulative hours (right axis)
    - Vertical column bands, white background, unified hover
    """
    if df_filtered.empty:
        fig = go.Figure()
        fig.add_annotation(
            text="No study data yet. Start using the AI Tutor!",
            xref="paper", yref="paper", x=0.5, y=0.5,
            xanchor="center", yanchor="middle",
            showarrow=False, font=dict(size=15, color="#aaa")
        )
        fig.update_layout(
            title="Study Hours", height=360,
            plot_bgcolor="#fff", paper_bgcolor="#fff",
            xaxis=dict(visible=False), yaxis=dict(visible=False)
        )
        return fig

    grp, line_shape, marker, mode = _aggregate(df_filtered)
    cumulative = grp["hours"].cumsum()
    total = grp["hours"].sum()

    shapes = []
    for i in range(len(grp)):
        if i % 2 == 0:
            shapes.append(dict(
                type="rect", xref="x", yref="paper",
                x0=i - 0.5, x1=i + 0.5, y0=0, y1=1,
                fillcolor="rgba(200,220,240,0.18)", line_width=0, layer="below"
            ))

    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=grp["x"], y=grp["hours"],
        mode=mode, name="Hours",
        line=dict(color="rgba(66,133,244,1)", width=2.5, shape=line_shape, smoothing=1.2),
        marker=dict(color="rgba(66,133,244,1)", **marker),
        fill="tozeroy", fillcolor="rgba(66,133,244,0.15)",
        hovertemplate="<b>%{x}</b><br>Hours: %{y:.1f}h<br>Questions: %{customdata}<extra></extra>",
        customdata=grp["questions"],
    ))
    fig.add_trace(go.Scatter(
        x=grp["x"], y=cumulative,
        mode=mode, name="Cumulative",
        line=dict(color="rgba(251,171,53,1)", width=2.5, shape=line_shape, smoothing=1.2),
        marker=dict(color="rgba(251,171,53,1)", **marker),
        fill="tozeroy", fillcolor="rgba(251,171,53,0.08)",
        yaxis="y2",
        hovertemplate="<b>%{x}</b><br>Total: %{y:.1f}h<extra></extra>",
    ))

    fig.update_layout(
        title=dict(
            text=f"Study Hours — {period}   <span style='font-size:13px;color:#888'>Total: {total:.1f}h</span>",
            font=dict(size=16)
        ),
        xaxis=dict(showgrid=False, tickfont=dict(size=12, color="#888"), zeroline=False),
        yaxis=dict(
            title="Hours", showgrid=True,
            gridcolor="rgba(200,200,200,0.3)", zeroline=False, tickfont=dict(color="#888"),
        ),
        yaxis2=dict(
            title="Cumulative", overlaying="y", side="right",
            showgrid=False, zeroline=False, tickfont=dict(color="#888"),
        ),
        shapes=shapes,
        hovermode="x unified",
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        height=360,
        margin=dict(l=10, r=10, t=50, b=10),
        plot_bgcolor="#fff", paper_bgcolor="#fff",
    )
    return fig


def create_activity_chart(df_filtered: pd.DataFrame, period: str):
    """Smooth area chart for questions + quizzes over time — same visual style as study hours."""
    if df_filtered.empty:
        return None

    grp, line_shape, marker, mode = _aggregate(df_filtered)

    shapes = []
    for i in range(len(grp)):
        if i % 2 == 0:
            shapes.append(dict(
                type="rect", xref="x", yref="paper",
                x0=i - 0.5, x1=i + 0.5, y0=0, y1=1,
                fillcolor="rgba(200,220,240,0.18)", line_width=0, layer="below"
            ))

    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=grp["x"], y=grp["questions"],
        mode=mode, name="Questions",
        line=dict(color="rgba(66,133,244,1)", width=2.5, shape=line_shape, smoothing=1.2),
        marker=dict(color="rgba(66,133,244,1)", **marker),
        fill="tozeroy", fillcolor="rgba(66,133,244,0.12)",
        hovertemplate="<b>%{x}</b><br>Questions: %{y}<extra></extra>",
    ))
    fig.add_trace(go.Scatter(
        x=grp["x"], y=grp["quizzes"],
        mode=mode, name="Quizzes",
        line=dict(color="rgba(251,171,53,1)", width=2.5, shape=line_shape, smoothing=1.2),
        marker=dict(color="rgba(251,171,53,1)", **marker),
        fill="tozeroy", fillcolor="rgba(251,171,53,0.10)",
        hovertemplate="<b>%{x}</b><br>Quizzes: %{y}<extra></extra>",
    ))
    fig.update_layout(
        title=dict(text=f"Activity — {period}", font=dict(size=16)),
        xaxis=dict(showgrid=False, tickfont=dict(size=12, color="#888"), zeroline=False),
        yaxis=dict(showgrid=True, gridcolor="rgba(200,200,200,0.3)", zeroline=False, tickfont=dict(color="#888")),
        shapes=shapes,
        hovermode="x unified",
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        height=320,
        margin=dict(l=10, r=10, t=50, b=10),
        plot_bgcolor="#fff",
        paper_bgcolor="#fff",
    )
    return fig


def create_course_mastery(stats, df_all: pd.DataFrame):
    """
    Horizontal bar chart showing per-course engagement score.
    Score = questions asked + quizzes × 3 + docs × 2  (normalised to 100).
    Much more readable than a radar and directly actionable.
    """
    courses = stats.get("courses", [])
    if not courses:
        return None

    # Build per-course question counts from recent_questions
    q_by_course: dict = {}
    for q in stats.get("recent_questions", []):
        c = q.get("course", "")
        q_by_course[c] = q_by_course.get(c, 0) + 1

    names, scores, doc_counts, q_counts = [], [], [], []
    for c in courses:
        cid   = c["id"]
        docs  = c["document_count"]
        qs    = q_by_course.get(cid, 0)
        score = min(qs * 2 + docs * 5, 100)
        names.append(c["name"])
        scores.append(score)
        doc_counts.append(docs)
        q_counts.append(qs)

    # Sort by score descending
    order = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
    names      = [names[i]      for i in order]
    scores     = [scores[i]     for i in order]
    doc_counts = [doc_counts[i] for i in order]
    q_counts   = [q_counts[i]   for i in order]

    colors = [
        f"rgba(66,133,244,{0.5 + 0.5 * s / 100})" for s in scores
    ]

    fig = go.Figure(go.Bar(
        x=scores,
        y=names,
        orientation="h",
        marker=dict(color=colors, line=dict(width=0)),
        customdata=list(zip(doc_counts, q_counts)),
        hovertemplate=(
            "<b>%{y}</b><br>"
            "Engagement: %{x}/100<br>"
            "Docs: %{customdata[0]}  |  Questions: %{customdata[1]}"
            "<extra></extra>"
        ),
        text=[f"{s}/100" for s in scores],
        textposition="outside",
    ))

    fig.update_layout(
        title="Course Engagement",
        xaxis=dict(range=[0, 115], showgrid=False, zeroline=False, visible=False),
        yaxis=dict(showgrid=False, tickfont=dict(size=12)),
        height=360,
        margin=dict(l=10, r=40, t=50, b=10),
        plot_bgcolor="#fff",
        paper_bgcolor="#fff",
    )
    return fig


def create_course_pie(stats):
    courses = stats.get("courses", [])
    if not courses:
        return None
    fig = go.Figure(data=[go.Pie(
        labels=[c["name"] for c in courses],
        values=[c["document_count"] for c in courses],
        hole=0.4,
        hovertemplate="<b>%{label}</b><br>Docs: %{value}<br>%{percent}<extra></extra>"
    )])
    fig.update_layout(
        title="Documents by Course", height=360,
        plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)"
    )
    return fig


def show():
    st.title("Dashboard")

    # Fetch stats
    try:
        headers = auth_manager.get_auth_headers()
        response = requests.get(f"{API_URL}/api/stats/stats", headers=headers)
        stats = response.json() if response.status_code == 200 else {}
    except Exception:
        st.error("Could not fetch stats. Make sure the backend is running.")
        stats = {}

    stats.setdefault("total_documents", 0)
    stats.setdefault("total_courses", 0)
    stats.setdefault("study_hours", 0.0)
    stats.setdefault("quizzes_taken", 0)
    stats.setdefault("recent_questions", [])
    stats.setdefault("daily_activity", {})

    # Build full dataframe from daily activity
    df_all = _build_monthly_df(stats["daily_activity"])

    # ── Period selector ──────────────────────────────────────────────────────
    period_options = ["This Month", "Last 3 Months", "Last 6 Months", "All Time"]
    period = st.selectbox(
        "Time period",
        period_options,
        index=2,
        key="dash_period",
        label_visibility="collapsed"
    )

    df = _filter_by_period(df_all, period)

    # Compute period-scoped totals for the metric cards
    period_hours     = round(df["hours"].sum(), 1)    if not df.empty else 0.0
    period_questions = int(df["questions"].sum())     if not df.empty else 0
    period_quizzes   = int(df["quizzes"].sum())       if not df.empty else 0

    # ── Metric cards ─────────────────────────────────────────────────────────
    c1, c2, c3, c4 = st.columns(4)
    with c1:
        st.metric("Documents", stats["total_documents"])
    with c2:
        st.metric("Courses", stats["total_courses"])
    with c3:
        st.metric(
            "Study Hours",
            f"{period_hours:.1f}h",
            delta=f"{period} total",
            delta_color="off"
        )
    with c4:
        st.metric(
            "Quizzes",
            period_quizzes,
            delta=f"{period_questions} questions asked",
            delta_color="off"
        )

    st.divider()

    # ── Charts ────────────────────────────────────────────────────────────────
    col1, col2 = st.columns([3, 2])
    with col1:
        st.plotly_chart(create_study_hours_chart(df, period), use_container_width=True)
    with col2:
        mastery = create_course_mastery(stats, df_all)
        if mastery:
            st.plotly_chart(mastery, use_container_width=True)
        else:
            st.info("Course engagement will appear once you start studying.")

    col1, col2 = st.columns([3, 2])
    with col1:
        activity_fig = create_activity_chart(df, period)
        if activity_fig:
            st.plotly_chart(activity_fig, use_container_width=True)
    with col2:
        pie = create_course_pie(stats)
        if pie:
            st.plotly_chart(pie, use_container_width=True)
        else:
            st.info("Course distribution will appear once you upload documents.")

    st.divider()

    # ── Recent activity ───────────────────────────────────────────────────────
    col1, col2 = st.columns(2)

    with col1:
        st.subheader("Recent Questions")
        questions = stats["recent_questions"]
        if questions:
            for q in reversed(questions[-5:]):
                st.info(f"**{q.get('course', 'Unknown')}**: {q.get('question', 'N/A')}")
                st.caption(f"{q.get('timestamp', '')[:10]}")
        else:
            st.caption("No questions yet. Head to AI Tutor to get started.")

    with col2:
        st.subheader("Your Courses")
        if stats.get("courses"):
            for course in stats["courses"][:5]:
                progress = min(course["document_count"] / 10, 1.0)
                st.markdown(f"**{course['name']}**")
                st.progress(progress)
                st.caption(f"{course['document_count']} documents")
                st.divider()
        else:
            st.caption("No courses yet. Go to Courses to create one.")

    st.divider()

    # ── Achievements ──────────────────────────────────────────────────────────
    st.subheader("Achievements")
    a1, a2, a3, a4 = st.columns(4)
    with a1:
        done = stats["total_documents"] >= 5
        (st.success if done else st.info)(
            "Document Master — 5+ docs uploaded" if done
            else f"Upload {5 - stats['total_documents']} more documents"
        )
    with a2:
        done = stats["quizzes_taken"] >= 3
        (st.success if done else st.info)(
            "Quiz Champion — 3+ quizzes done" if done
            else f"Complete {3 - stats['quizzes_taken']} more quizzes"
        )
    with a3:
        done = stats["study_hours"] >= 10
        (st.success if done else st.info)(
            "Study Warrior — 10+ hours studied" if done
            else f"Study {max(0, 10 - stats['study_hours']):.1f} more hours"
        )
    with a4:
        total_q = len(stats["recent_questions"])
        done = total_q >= 10
        (st.success if done else st.info)(
            "Curious Mind — 10+ questions asked" if done
            else f"Ask {10 - total_q} more questions"
        )

