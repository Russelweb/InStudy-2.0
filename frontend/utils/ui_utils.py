import streamlit as st
import time
import threading
from typing import Callable, List, Dict, Any, Tuple

def run_with_dynamic_progress(
    target_func: Callable, 
    args: Tuple = (), 
    kwargs: Dict = {}, 
    messages: List[str] = None,
    estimated_time: float = 10.0
) -> Tuple[Any, Any]:
    """
    Run a function in a background thread while showing a dynamic progress bar.
    
    Args:
        target_func: The function to execute
        args: Positional arguments for the function
        kwargs: Keyword arguments for the function
        messages: List of messages to cycle through
        estimated_time: Estimated time in seconds for the progress bar to reach 95%
        
    Returns:
        A tuple of (result, error)
    """
    if messages is None:
        messages = ["Processing...", "Please wait...", "Almost there...", "Finalizing..."]
        
    result = {"data": None, "error": None, "done": False}
    
    def thread_func():
        try:
            result["data"] = target_func(*args, **kwargs)
        except Exception as e:
            result["error"] = str(e)
        finally:
            result["done"] = True
            
    # Start thread
    thread = threading.Thread(target=thread_func)
    thread.start()
    
    # UI Elements
    progress_placeholder = st.empty()
    message_placeholder = st.empty()
    
    # Progress loop
    start_time = time.time()
    msg_idx = 0
    last_msg_update = start_time
    
    while not result["done"]:
        elapsed = time.time() - start_time
        # Asymptotic progress bar: gets slower as it approaches 100% but never reaches it
        # Formula: 1 - e^(-t/tau)
        progress = min(int(99 * (1 - 2**(-elapsed / (estimated_time/2)))), 98)
        
        # Display custom progress bar with HTML for "stunning" look
        progress_placeholder.markdown(f"""
            <div style="width: 100%; background-color: rgba(255,255,255,0.05); border-radius: 10px; height: 12px; margin-bottom: 5px; overflow: hidden; border: 1px solid rgba(255,255,255,0.05);">
                <div style="width: {progress}%; background: linear-gradient(90deg, #FF7F50, #FF6347); height: 100%; transition: width 0.5s ease-in-out; box-shadow: 0 0 15px rgba(255,127,80,0.5);">
                </div>
            </div>
        """, unsafe_allow_html=True)
        
        # Update message every 3 seconds
        if time.time() - last_msg_update > 3.0:
            msg_idx = (msg_idx + 1) % len(messages)
            last_msg_update = time.time()
            
        message_placeholder.markdown(f"<p style='text-align: center; color: rgba(255,255,255,0.6); font-style: italic; font-size: 1.1rem;'>✨ {messages[msg_idx]}</p>", unsafe_allow_html=True)
        
        time.sleep(0.4)
        
    # Finish up
    if not result["error"]:
        progress_placeholder.markdown(f"""
            <div style="width: 100%; background-color: rgba(255,255,255,0.05); border-radius: 10px; height: 12px; margin-bottom: 5px; overflow: hidden;">
                <div style="width: 100%; background: linear-gradient(90deg, #FF7F50, #FF6347); height: 100%;">
                </div>
            </div>
        """, unsafe_allow_html=True)
        message_placeholder.markdown("<p style='text-align: center; color: #FF7F50; font-weight: bold; font-size: 1.1rem;'>✅ Complete!</p>", unsafe_allow_html=True)
        time.sleep(0.8)
    
    # Clean up UI
    progress_placeholder.empty()
    message_placeholder.empty()
    
    return result["data"], result["error"]
