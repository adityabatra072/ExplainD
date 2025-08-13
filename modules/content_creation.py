import json
import re
from .local_llm_api import query_local_model

# --- Model Configuration ---

EXPLANATION_MODEL = "mistral"
CODE_MODEL = "mistral"


# --- PROMPT TEMPLATES ---

STORYBOARD_PROMPT_TEMPLATE = """
You are an expert educational content creator. Your task is to generate a 3-frame storyboard to explain a topic to a specific audience. Each frame must be a distinct, visualizable concept.

**Topic:** {topic}
**Audience:** {audience}

**Instructions:**
1.  Create exactly 3 frames.
2.  Each frame needs a short, catchy `title` (max 5 words).
3.  Each frame needs a `description` of the visual animation (2-3 sentences).
4.  Do NOT include quizzes or introductions.
5.  Your entire output must be ONLY the JSON object, with no other text before or after it.

**Example Format:**
```json
{{
  "frames": [
    {{"title": "First Concept", "description": "A visual of the first idea."}},
    {{"title": "Second Concept", "description": "An animation showing the transition."}},
    {{"title": "Third Concept", "description": "A final visual summarizing the topic."}}
  ]
}}
```
"""

SCENE_AGENT_PROMPT_TEMPLATE = """
You are a scriptwriter for the YouTube channel 3Blue1Brown. Your task is to take a frame description and generate a narration script and a detailed animation description.

**Frame Description:** "{frame_description}"

**Instructions:**
1.  Write a `narration` script. It must be engaging, clear, and strictly less than 30 words.
2.  Write an `animation-description` that details the visuals, positions, and movements on screen.
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

**CRITICAL INSTRUCTIONS:**
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
    """Generates a storyboard from a topic and audience using the explanation model."""
    prompt = STORYBOARD_PROMPT_TEMPLATE.format(topic=topic, audience=audience)
    response = query_local_model(prompt, model_name=EXPLANATION_MODEL)
    return _extract_json_from_response(response) if response else {}

def generate_scene_details(frame_description: str) -> dict:
    """Generates scene details (narration, animation) for one frame using the explanation model."""
    prompt = SCENE_AGENT_PROMPT_TEMPLATE.format(frame_description=frame_description)
    response = query_local_model(prompt, model_name=EXPLANATION_MODEL)
    return _extract_json_from_response(response) if response else {}

def generate_manim_code(animation_description: str, scene_number: int) -> str:
    """Generates the final Manim Python code for a scene using the code model."""
    scene_class_name = f"Scene{scene_number}"
    prompt = MANIM_CODE_PROMPT_TEMPLATE.format(
        animation_description=animation_description,
        scene_class_name=scene_class_name
    )
    code = query_local_model(prompt, model_name=CODE_MODEL)
    
    if not code:
        return "# Failed to generate code."

    # Clean up any accidental markdown formatting from the AI model
    if "```python" in code:
        code = code.split("```python")[1].strip()
    if "```" in code:
        code = code.split("```")[0].strip()
        
    return code

#test and debug
if __name__ == '__main__':
    print("--- Testing Content Creation Module ---")
    test_topic = "Pythagorean Theorem"
    test_audience = "Middle Schooler"

    # --- Test Storyboard Creation ---
    print(f"\n[1/3] Generating storyboard for '{test_topic}'...")
    storyboard = create_storyboard(test_topic, test_audience)
    
    if storyboard and storyboard.get("frames"):
        print("Storyboard generated successfully:")
        print(json.dumps(storyboard, indent=2))
        
        first_frame = storyboard["frames"][0]
        
        # ---Test Scene Detail Generation ---
        print(f"\n[2/3] Generating scene details for first frame...")
        scene_details = generate_scene_details(first_frame['description'])
        
        if scene_details:
            print("Scene details generated successfully:")
            print(json.dumps(scene_details, indent=2))
            
            # ---Test Manim Code Generation ---
            print(f"\n[3/3] Generating Manim code...")
            manim_code = generate_manim_code(scene_details['animation-description'], 1)
            
            if manim_code and not manim_code.startswith("# Failed"):
                print("Manim code generated successfully:")
                print("-" * 20)
                print(manim_code)
                print("-" * 20)
                print("\nFull module test successful!")
            else:
                print("Manim code generation failed.")
        else:
            print("Scene detail generation failed.")
    else:
        print("Storyboard generation failed.")