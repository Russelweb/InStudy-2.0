import streamlit as st
import plotly.graph_objects as go

def show():
    st.title("📊 Dashboard")
    
    # Stats
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric("Documents", "12", "+3")
    with col2:
        st.metric("Courses", "4", "+1")
    with col3:
        st.metric("Study Hours", "24.5", "+2.5")
    with col4:
        st.metric("Quizzes Taken", "8", "+2")
    
    st.divider()
    
    # Recent activity
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("Recent Questions")
        st.info("What is gradient descent?")
        st.info("Explain neural networks")
        st.info("How does backpropagation work?")
    
    with col2:
        st.subheader("Study Progress")
        
        # Simple progress chart
        fig = go.Figure(data=[
            go.Bar(x=["Mon", "Tue", "Wed", "Thu", "Fri"], 
                   y=[2, 3, 1.5, 4, 2.5])
        ])
        fig.update_layout(
            title="Study Hours This Week",
            xaxis_title="Day",
            yaxis_title="Hours",
            height=300
        )
        st.plotly_chart(fig, use_container_width=True)
