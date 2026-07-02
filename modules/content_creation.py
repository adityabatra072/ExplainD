import json
import re
from .openai_llm import generate
from .wiki_storyboard import build_dynamic_frames

# --- Model Configuration ---

EXPLANATION_MODEL = "gpt-4o"
CODE_MODEL = "gpt-4o"

# --- PROMPT TEMPLATES ---
# Kept for compatibility; dynamic frames come from wiki_storyboard
SCENE_AGENT_PROMPT_TEMPLATE = """
You are a scriptwriter for the YouTube channel 3Blue1Brown. Your task is to take a frame description and generate a narration script and a detailed animation description.

**Frame Description:** "{frame_description}"

**Instructions:**
1.  Write a `narration` script. It must be engaging, clear, and strictly less than 30 words.
2.  Write a `animation-description` that details the visuals, positions, and movements on screen.
3.  Your entire output must be ONLY the JSON object, with no other text before or after it.

**Example Format:**
```json
{{
  "narration": "Here we see two vectors, arrows pointing from the origin.",
  "animation-description": "A 2D coordinate plane appears. Two vectors, v1=[2,1] and v2=[-1,2], are drawn from the origin as yellow and blue arrows respectively. MathTex labels appear next to their tips."
}}
```
"""

MANIM_CODE_PROMPT_TEMPLATE = """
You are an expert Manim programmer. Your task is to write a complete, simple, and runnable Manim Community Edition (v0.19.0) Python script based on the provided details.

**Scene Class Name:** {scene_class_name}
**Animation Description:** "{animation_description}"

**CRITICAL INSTRUCTIONS:"
1.  The code MUST be for ManimCE v0.19.0.
2.  The code must be EXTREMELY SIMPLE.
3.  ABSOLUTELY NO LOOPS (`for`, `while`), list comprehensions, or custom functions.
4.  Use only simple, sequential `self.play()` calls.
5.  Use standard colors: `BLUE`, `RED`, `YELLOW`, `GREEN`, `WHITE`.
6.  Ensure text and objects do not overlap. Use `.to_edge()`, `.next_to()`, and `.shift()`.
7.  Your entire output must be ONLY the Python code, with no other text, explanations, or markdown formatting like ```python.

**Example of valid code:**
```python
from manim import *

class VectorIntro(Scene):
    def construct(self):
        axes = Axes(x_range=[-5, 5, 1], y_range=[-3, 3, 1])
        vector = Arrow(ORIGIN, [2, 1, 0], buff=0, color=YELLOW)
        self.play(Create(axes))
        self.play(GrowArrow(vector))
        self.wait(1)
```
"""


def _extract_json_from_response(text: str) -> dict:
    # regex to find a JSON object even if it's embedded in other text
    json_match = re.search(r'\{.*\}', text, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group(0))
        except json.JSONDecodeError:
            print(f"Warning: Could not decode JSON from response: {text}")
            return {}
    print(f"Warning: No JSON object found in the response.")
    return {}


def create_storyboard(topic: str, audience: str) -> dict:
    # Build storyboard frames dynamically using OpenAI + Wikipedia data when available
    try:
        frames = build_dynamic_frames(topic, max_frames=5).get("frames", [])
        if frames:
            return {"frames": frames}
    except Exception:
        pass
    # Fallback to a 3-frame progression
    frames = [
        {"title": f"Intro to {topic}", "description": f"An opening concept about {topic}."},
        {"title": f"Deeper into {topic}", "description": "Builds on the first idea with more detail."},
        {"title": f"Mastery of {topic}", "description": "Consolidates core ideas into a takeaway."},
    ]
    return {"frames": frames[:3]}


def generate_scene_details(frame_description: str) -> dict:
    prompt = SCENE_AGENT_PROMPT_TEMPLATE.format(frame_description=frame_description)
    response = generate(prompt, model=EXPLANATION_MODEL)
    return _extract_json_from_response(response) if response else {}


def generate_manim_code(animation_description: str, scene_number: int) -> str:
    scene_class_name = f"Scene{scene_number}"
    prompt = MANIM_CODE_PROMPT_TEMPLATE.format(
        animation_description=animation_description,
        scene_class_name=scene_class_name
    )
    code = generate(prompt, model=CODE_MODEL)
    if not code:
        return "# Failed to generate code."
    if "```python" in code:
        code = code.split("```python")[1].strip()
    if "```" in code:
        code = code.split("```")[0].strip()
    return code

# Removed __main__ test block to keep runtime clean
