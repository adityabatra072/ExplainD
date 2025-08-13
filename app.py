import streamlit as st
import re
import os
from modules.content_creation import create_storyboard, generate_scene_details, generate_manim_code
from modules.video_generator import render_manim_video
from modules.video_merger import stitch_videos

# --- Page Configuration ---
st.set_page_config(
    layout="centered",
    page_title="ExplainD",
    page_icon="💡"
)

# --- Custom CSS for Professional UI ---
st.markdown("""
    <style>
        /* Main container styling */
        .main-container {
            max-width: 800px;
            margin: auto;
            padding-top: 2rem;
        }
        /* Prompt input box */
        .stTextArea textarea {
            min-height: 100px;
            border-radius: 10px;
            border: 1px solid #4a4a4a;
        }
        /* Button styling */
        .stButton>button {
            width: 100%;
            border-radius: 10px;
            border: none;
            background-color: #3b82f6;
            color: white;
        }
        /* Expander styling */
        .stExpander {
            border: 1px solid #333;
            border-radius: 10px;
        }
        /* Remove Streamlit branding */
        footer {visibility: hidden;}
    </style>
""", unsafe_allow_html=True)

# --- App State Initialization ---
if 'scenes_data' not in st.session_state:
    st.session_state.scenes_data = []
if 'rendered_videos' not in st.session_state:
    st.session_state.rendered_videos = {}
if 'final_video_path' not in st.session_state:
    st.session_state.final_video_path = None
if 'run_id' not in st.session_state:
    st.session_state.run_id = 0

# --- Main App Layout ---
with st.container():
    st.title("ExplainD")
    st.markdown("Your AI partner for creating educational animations. Simply describe a topic, and watch it come to life.")

    # --- Prompt Input Form ---
    with st.form(key='prompt_form'):
        topic = st.text_area(
            "Enter the topic you want to explain:",
            placeholder="e.g., How does photosynthesis work?",
            height=120
        )
        audience = st.selectbox(
            "Select the target audience:",
            ("High School Student", "College Student", "Curious Adult"),
            index=0
        )
        submit_button = st.form_submit_button(label="✨ Generate Animation")

    if submit_button:
        if not topic:
            st.error("Please enter a topic to explain.")
        else:
            # Reset state for a new run
            st.session_state.run_id += 1
            st.session_state.scenes_data = []
            st.session_state.rendered_videos = {}
            st.session_state.final_video_path = None

            progress_bar = st.progress(0, text="Initializing...")
            
            # --- Pipeline Execution ---
            storyboard = create_storyboard(topic, audience)
            progress_bar.progress(25, text="Storyboard generated. Creating scenes...")
            
            if storyboard and "frames" in storyboard:
                scenes_data = []
                for i, frame in enumerate(storyboard["frames"]):
                    details = generate_scene_details(frame.get('description', ''))
                    if details:
                        code = generate_manim_code(details.get("animation-description", ""), i + 1)
                        scenes_data.append({
                            "scene_number": i + 1, "title": frame.get('title', f'Scene {i+1}'),
                            "narration": details.get("narration", ""), "code": code
                        })
                st.session_state.scenes_data = scenes_data
                progress_bar.progress(50, text="Scripts and code generated. Ready to render.")
            else:
                st.error("Failed to generate storyboard. Please ensure Ollama is running.")
                progress_bar.empty()

# --- Display Results ---
if st.session_state.scenes_data:
    st.markdown("---")
    st.header("Generated Scenes")
    
    for scene in st.session_state.scenes_data:
        scene_num = scene["scene_number"]
        run_key = f"{st.session_state.run_id}_{scene_num}"
        with st.expander(f"Scene {scene_num}: {scene['title']}", expanded=True):
            st.code(scene['code'], language='python')
            
            if scene_num in st.session_state.rendered_videos:
                st.video(st.session_state.rendered_videos[scene_num])
            else:
                if st.button(f"Render Scene {scene_num}", key=f"render_{run_key}", use_container_width=True):
                    scene_name = f"Scene{scene_num}"
                    with st.spinner(f"Rendering Scene {scene_num}... This may take a few minutes."):
                        video_path = render_manim_video(scene['code'], scene_name, scene['narration'])
                    if video_path and os.path.exists(video_path):
                        st.session_state.rendered_videos[scene_num] = video_path
                        st.rerun()
                    else:
                        st.error(f"Failed to render Scene {scene_num}. Check terminal for errors.")

    if len(st.session_state.rendered_videos) == len(st.session_state.scenes_data):
        st.markdown("---")
        st.header("Final Combined Video")
        if st.button("Stitch All Scenes", use_container_width=True):
            with st.spinner("Stitching final video..."):
                video_paths = [st.session_state.rendered_videos[i+1] for i in range(len(st.session_state.scenes_data))]
                final_path = os.path.join("output", f"final_video_{st.session_state.run_id}.mp4")
                if stitch_videos(video_paths, final_path):
                    st.session_state.final_video_path = final_path
                else:
                    st.error("Failed to stitch the final video.")
    
    if st.session_state.final_video_path:
        st.video(st.session_state.final_video_path)
