import logging
import os
import streamlit as st
try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass
from modules.concept_explainer import explain_topic
import modules.video_generator as vg

# Logging setup for console and file
log_dir = os.path.join(os.getcwd(), 'logs')
os.makedirs(log_dir, exist_ok=True)
log_file = os.path.join(log_dir, 'explainD.log')
logging.basicConfig(level=logging.INFO, handlers=[logging.FileHandler(log_file, encoding='utf-8'), logging.StreamHandler()], format='%(asctime)s - %(levelname)s - %(message)s')

# UI Config
st.set_page_config(layout="centered", page_title="ExplainD", page_icon=None)

# UI styling
st.markdown("<style>" +
            "body{font-family:Arial, sans-serif;}" +
            " .main {max-width: 900px; margin: auto; padding: 20px;}" +
            " .title {font-size: 28px; font-weight: bold; margin-bottom: 12px;}" +
            " .card {border:1px solid #ddd; border-radius:8px; padding:16px; margin-bottom:12px; box-shadow: 0 2px 6px rgba(0,0,0,.05);}" +
            "</style>", unsafe_allow_html=True)

status_area = st.empty()
status_area.text("Ready.")

with st.form(key='topic_form'):
    topic = st.text_input(label='Topic', value='Arrays')
    audience = st.selectbox('Audience', ['Middle School', 'High School', 'Undergraduate'])
    submit = st.form_submit_button(label='Explain')

if submit and topic:
    logging.info(f"Explain requested for topic: {topic} (audience: {audience})")
    status_area.text("Initializing explainer pipeline...")
    try:
        explainer = explain_topic(topic, audience)
        if not explainer:
            status_area.error("Failed to generate explainer. OpenAI may be unavailable or topic too broad.")
            logging.error("Explainer generation returned None")
        else:
            status_area.text("Script and plan generated. Rendering video...")
            logging.info("Generated script and manim code, starting render.")
            # Preview
            st.subheader("Explainer Script Preview")
            st.code(explainer.get('script',''), language='text')
            # Build scene list and narration from explainer
            manim_code = explainer.get('manim_code','')
            scene_names = explainer.get('scene_names', ["Scene1","Scene2","Scene3","Scene4"])
            narrations = explainer.get('narrations', []) or []
            narration_text = " ".join(narrations) if narrations else explainer.get('script','')
            video_path = vg.render_all_scenes(manim_code, scene_names, narration_text)
            if video_path and os.path.exists(video_path):
                status_area.success("Video generated successfully.")
                st.video(video_path)
                logging.info(f"Video ready at {video_path}")
            else:
                status_area.error("Video rendering failed. See console for details.")
                logging.error("Video render failed; path not found or render error occurred.")
    except Exception as e:
        status_area.error(f"Unhandled error: {e}")
        logging.exception("Unhandled error during explain flow")
