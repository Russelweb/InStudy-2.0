import streamlit as st
import requests
import os
import logging

logger = logging.getLogger(__name__)
API_URL = os.getenv("API_URL", "http://localhost:8000")

@st.cache_data(ttl=300)  # Cache for 5 minutes
def get_dashboard_stats(headers: dict):
    """Fetch dashboard statistics with caching"""
    try:
        response = requests.get(f"{API_URL}/api/stats/stats", headers=headers, timeout=10)
        if response.status_code == 200:
            return response.json()
    except Exception as e:
        logger.error(f"Error fetching stats: {e}")
    return {}

@st.cache_data(ttl=300)  # Cache for 5 minutes
def get_courses(headers: dict):
    """Fetch user courses with caching"""
    try:
        response = requests.get(f"{API_URL}/api/stats/courses", headers=headers, timeout=10)
        if response.status_code == 200:
            return response.json().get("courses", [])
    except Exception as e:
        logger.error(f"Error fetching courses: {e}")
    return []

def clear_api_cache():
    """Clear all API caches to force refresh"""
    st.cache_data.clear()
