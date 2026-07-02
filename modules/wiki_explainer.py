import json
import requests
from typing import List

from .openai_llm import generate

WIKI_SUMMARY_API = "https://en.wikipedia.org/api/rest_v1/page/summary/"


def _fetch_wiki_summary(topic: str) -> str:
    url_topic = topic.replace(" ", "_")
    url = WIKI_SUMMARY_API + url_topic
    try:
        r = requests.get(url, timeout=10)
        if r.ok:
            data = r.json()
            return data.get("extract", data.get("description", "")) or ""
    except Exception:
        pass
    return ""


def seed_topic(topic: str) -> str:
    return _fetch_wiki_summary(topic)


def build_outline(topic: str, audience: str, depth: int = 3) -> List[str]:
    seed = seed_topic(topic)
    prompt = (
        f"You are an experienced educator. Topic: '{topic}'. Audience: '{audience}'. Seed: '{seed}'. "
        f"Create a cohesive outline for a comprehensive explanation. Include between {max(3, depth)} and 5 sections."
    )
    response = generate(prompt, model="gpt-4o", temperature=0.7)
    if response:
        try:
            data = json.loads(response)
            sections = data.get("sections") or data.get("outline") or []
            if isinstance(sections, list):
                return [sec if isinstance(sec, str) else sec.get("title", str(sec)) for sec in sections]
        except Exception:
            pass
    # Fallback outline
    return ["Introduction", "Core Concepts", "Examples", "Summary"]


# Four-scene cohesion helpers (four-scene focused seeds and outlines)

def seed_and_outline_four(topic: str, audience: str) -> dict:
    return {
        "seed": seed_topic(topic),
        "outline": build_outline(topic, audience, depth=4),
    }

