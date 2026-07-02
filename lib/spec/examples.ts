import type { LessonSpecT, SceneSpecT } from "./schema";
import { LessonSpec } from "./schema";

/**
 * Hand-written reference lesson. Serves three jobs:
 * 1. Phase-1 renderer test fixture.
 * 2. Few-shot example inside generation prompts.
 * 3. The landing-page specimen animation.
 */
export const derivativeLessonRaw = {
  version: 1,
  title: "Why derivatives are slopes",
  audience: "high-school",
  scenes: [
    {
      id: "s1",
      title: "The question",
      narration:
        "Here's a curve. At any point on it, we can ask a simple question: how steep is it, right here? Not on average — exactly at this point. That single question is what the derivative answers.",
      layout: "split-lr",
      elements: [
        {
          id: "graph",
          type: "plot",
          region: { col: 0, row: 0, colSpan: 7, rowSpan: 8 },
          fns: [{ id: "f", expr: "x^2/4", color: "accent", label: "f(x)" }],
          xDomain: [-1, 5],
          points: [{ id: "p", x: 2, y: 1, label: "P", color: "secondary" }],
        },
        {
          id: "q",
          type: "title",
          region: { col: 7, row: 2, colSpan: 5, rowSpan: 2 },
          text: "How steep is the curve at P?",
          size: "md",
        },
        {
          id: "hint",
          type: "text",
          region: { col: 7, row: 4, colSpan: 5, rowSpan: 2 },
          text: "Not on average — *exactly here*.",
          size: "md",
          color: "muted",
        },
      ],
      beats: [
        { at: 0, target: "graph", action: "enter", effect: "fade" },
        { atWord: "curve", at: 0.02, target: "graph.f", action: "draw", effect: "draw-in", durationMs: 1400 },
        { atWord: "here", at: 0.3, target: "graph.p", action: "enter", effect: "scale", durationMs: 500 },
        { atWord: "average", at: 0.55, target: "q", action: "enter", effect: "slide-up" },
        { atWord: "derivative", at: 0.85, target: "hint", action: "enter", effect: "fade" },
      ],
      transitionIn: "fade",
    },
    {
      id: "s2",
      title: "Secant to tangent",
      narration:
        "Pick a second point Q and draw a line through both. That's a secant — its slope is an average steepness. Now slide Q toward P. Watch the line tilt. As the gap shrinks to nothing, the secant settles into the tangent, and its slope becomes the exact steepness at P.",
      layout: "split-lr",
      elements: [
        {
          id: "graph",
          type: "plot",
          region: { col: 0, row: 0, colSpan: 7, rowSpan: 8 },
          fns: [
            { id: "f", expr: "x^2/4", color: "accent" },
            { id: "secant", expr: "1.5*x - 2", color: "secondary", label: "secant" },
            { id: "tangent", expr: "x - 1", color: "positive", label: "tangent" },
          ],
          xDomain: [-1, 5],
          points: [
            { id: "p", x: 2, y: 1, label: "P", color: "secondary" },
            { id: "q", x: 4, y: 4, label: "Q", color: "muted" },
          ],
        },
        {
          id: "eq",
          type: "math",
          region: { col: 7, row: 2, colSpan: 5, rowSpan: 3 },
          latex: "f'(x)=\\lim_{h\\to 0}\\frac{f(x+h)-f(x)}{h}",
          parts: [
            { id: "lim", latex: "\\lim_{h\\to 0}" },
            { id: "quot", latex: "\\frac{f(x+h)-f(x)}{h}" },
          ],
          size: "md",
        },
        {
          id: "cap",
          type: "text",
          region: { col: 7, row: 5, colSpan: 5, rowSpan: 2 },
          text: "The tangent's slope **is** $f'(x)$.",
          size: "md",
        },
      ],
      beats: [
        { at: 0, target: "graph", action: "enter", effect: "fade" },
        { at: 0, target: "graph.f", action: "draw", effect: "draw-in", durationMs: 900 },
        { atWord: "second", at: 0.05, target: "graph.q", action: "enter", effect: "scale" },
        { atWord: "secant", at: 0.12, target: "graph.secant", action: "draw", effect: "draw-in", durationMs: 1000 },
        { atWord: "average", at: 0.25, target: "eq.quot", action: "reveal-part", effect: "fade" },
        { atWord: "shrinks", at: 0.6, target: "eq.lim", action: "reveal-part", effect: "slide-left" },
        { atWord: "tangent", at: 0.72, target: "graph.tangent", action: "draw", effect: "draw-in", durationMs: 1200 },
        { atWord: "exact", at: 0.9, target: "cap", action: "enter", effect: "slide-up" },
        { at: 0.92, target: "eq", action: "emphasize", durationMs: 1200 },
      ],
      transitionIn: "fade",
    },
    {
      id: "s3",
      title: "The takeaway",
      narration:
        "So a derivative isn't a mysterious formula. It's a slope — the slope of the tangent line, found by zooming in until the curve looks straight. Every rule you'll learn later is just a shortcut for this one idea.",
      layout: "center",
      elements: [
        {
          id: "headline",
          type: "title",
          region: { col: 1, row: 2, colSpan: 10, rowSpan: 2 },
          text: "A derivative is a slope.",
          size: "hero",
        },
        {
          id: "sub",
          type: "text",
          region: { col: 2, row: 4, colSpan: 8, rowSpan: 2 },
          text: "Zoom in far enough, and every smooth curve looks like a straight line.",
          align: "center",
          size: "lg",
          color: "muted",
        },
      ],
      beats: [
        { atWord: "slope", at: 0.15, target: "headline", action: "enter", effect: "slide-up", durationMs: 800 },
        { atWord: "zooming", at: 0.5, target: "sub", action: "enter", effect: "fade", durationMs: 900 },
        { at: 0.95, target: "headline", action: "emphasize", durationMs: 1500 },
      ],
      transitionIn: "wipe",
    },
  ],
};

export const derivativeLesson: LessonSpecT = LessonSpec.parse(derivativeLessonRaw);

/** Compact single-scene example embedded in generation prompts. */
export const fewShotScene: SceneSpecT = derivativeLesson.scenes[1];
