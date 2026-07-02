import textwrap
import json
import numpy as np
from typing import List
from .wiki_explainer import build_outline, seed_topic
from .openai_llm import generate

# Four-scene Manim code builder for a cohesive explainer

def _four_scenes_manim_code(topic: str) -> str:
    # A single script containing four Scenes with a cohesive narrative about the topic
    code = '''from manim import *
import numpy as np

class Scene1(Scene):
    def construct(self):
        axes = Axes(x_range=[-6,6,1], y_range=[-6,6,1], axis_config={"color": WHITE})
        self.play(Create(axes))
        line = axes.plot(lambda x: np.sin(x), color=BLUE, stroke_width=4)
        self.play(Create(line))
        self.wait(2)

class Scene2(Scene):
    def construct(self):
        axes = Axes(x_range=[-6,6,1], y_range=[-6,6,1], axis_config={"color": WHITE})
        self.play(Create(axes))
        v1 = Arrow(ORIGIN, np.array([3,1,0]), buff=0, color=YELLOW)
        v2 = Arrow(ORIGIN, np.array([1,2,0]), buff=0, color=RED)
        self.play(GrowArrow(v1), GrowArrow(v2))
        self.wait(1)
        self.play(Transform(v1, v2))
        self.wait(1)

class Scene3(Scene):
    def construct(self):
        axes = Axes(x_range=[-6,6,1], y_range=[-6,6,1], axis_config={"color": WHITE})
        self.play(Create(axes))
        a = 2
        b = 1
        line = axes.plot(lambda x: a*x + b, color=GREEN)
        self.play(Create(line))
        self.wait(2)
        self.play(line.animate.set_color(RED))
        self.wait(1)

class Scene4(Scene):
    def construct(self):
        text = Text("Takeaways: Cohesion in concepts, visual intuition, and stepwise derivations.", font_size=28)
        self.play(FadeIn(text))
        self.wait(2)
'''
    return code


def explain_topic(topic: str, audience: str) -> dict:
    # Build a cohesive outline and four-scene code
    outline = build_outline(topic, audience, depth=4)
    if not outline:
        outline = ["Intro", "Core Concepts of {0}".format(topic), "Examples & Applications of {0}".format(topic), "Summary"]
    # Generate per-scene narrations
    narrations: List[str] = []
    for i in range(4):
        prompt = f"Provide a concise narration for Scene {i+1} about {topic}. Audience: {audience}."
        n = generate(prompt, model="gpt-4o", temperature=0.7) or f"Scene {i+1} explanation of {topic}."
        narrations.append(n.strip())

    manim_code = _four_scenes_manim_code(topic)
    return {
        "topic": topic,
        "manim_code": manim_code,
        "scene_names": ["Scene1", "Scene2", "Scene3", "Scene4"],
        "narrations": narrations,
        "outline": outline[:4],
        "script": " ".join(narrations),
        # keep backward-compat with older keys if present
        "scenes": [
            {"scene": 1, "title": outline[0] if len(outline) > 0 else "Scene 1", "narration": narrations[0]},
            {"scene": 2, "title": outline[1] if len(outline) > 1 else "Scene 2", "narration": narrations[1]},
            {"scene": 3, "title": outline[2] if len(outline) > 2 else "Scene 3", "narration": narrations[2]},
            {"scene": 4, "title": outline[3] if len(outline) > 3 else "Scene 4", "narration": narrations[3]},
        ],
    }


