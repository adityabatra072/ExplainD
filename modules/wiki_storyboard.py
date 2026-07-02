import json
import requests
from typing import List, Dict

try:
    # Optional LangChain integration (best-effort)
    from langchain_community.utilities import WikipediaAPIWrapper  # type: ignore
    LANGCHAIN_AVAILABLE = True
except Exception:
    LANGCHAIN_AVAILABLE = False

from .openai_llm import generate

WIKI_SUMMARY_API = "https://en.wikipedia.org/api/rest_v1/page/summary/"


def fetch_wiki_summary(topic: str) -> str:
    # Attempt a lightweight REST fetch; encode topic for URL
    url_topic = topic.replace(" ", "_")
    url = WIKI_SUMMARY_API + url_topic
    try:
        r = requests.get(url, timeout=10)
        if r.ok:
            data = r.json()
            # Prefer the short extract if available
            return data.get("extract", data.get("description", "")) or ""
    except Exception:
        pass
    # Fallback empty
    return ""


def build_dynamic_frames(topic: str, max_frames: int = 5) -> Dict[str, List[Dict[str, str]]]:
    # Gather some wiki-backed insights (best-effort)
    insights = fetch_wiki_summary(topic)

    frames: List[Dict[str, str]] = []
    if insights:
        # Ask OpenAI to structure into 3-5 interconnected frames
        prompt = (
            f"You are a storyboard designer. Topic: '{topic}'. Insights: '{insights}'. "
            f"Create between 3 and {max_frames} frames that form a logical progression. "
            "For each frame, provide a short title (max 5 words) and a 2-4 sentence description. "
            "Return a JSON object with a 'frames' array of objects: { 'title': ..., 'description': ... }."
        )
        response = generate(prompt, model="gpt-4o", temperature=0.7)
        if response:
            try:
                parsed = json.loads(response)
                frames = parsed.get("frames", [])
            except Exception:
                frames = []
    if not frames:
        # Fallback: create a simple 3-frame progression based on topic
        frames = [
            {"title": f"Intro to {topic.split()[0]}", "description": f"An opening concept about {topic}."},
            {"title": f"Deeper into {topic.split()[0]}", "description": "Builds on the first idea with more detail."},
            {"title": f"Mastery of {topic.split()[0]}", "description": "Consolidates core ideas into a takeaway."},
        ]
        if max_frames > 3:
            frames = frames[:3]

    return {"frames": frames}

