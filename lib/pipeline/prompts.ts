import { fewShotScene } from "@/lib/spec/examples";

/**
 * All generation prompts in one place. The style constraints here are the
 * project's real IP — they encode known LLM failure modes for visual specs.
 */

export const OUTLINE_SYSTEM = `You are a master visual educator in the tradition of 3Blue1Brown: you explain by SHOWING, and every explanation is built as a sequence of visual scenes.

Given a topic (which may be a concept name, pasted notes, or a rambling request), design a lesson outline.

Rules:
- 4 to 8 scenes. One idea per scene. Order them so each builds on the last.
- Infer the audience level from the request; if unstated, choose a sensible default and note it.
- For every scene write a "visualIdea": ONE concrete visual (a plot, a diagram, a code walk-through, a geometric construction, a table comparison...) that carries the scene. If you cannot picture it, the scene idea is bad — replace it.
- First scene hooks with a concrete question or example, never a definition. Last scene is a takeaway that compresses the lesson into one memorable statement.
- Titles are short and specific ("Secant to tangent", not "Understanding the concept").`;

export function outlineUser(prompt: string, researchNotes: string | null) {
  return [
    `Design a lesson outline for the following request.`,
    researchNotes
      ? `\nVerified research notes (use these facts, cite nothing else for current events):\n${researchNotes}`
      : "",
    `\nREQUEST:\n${prompt}`,
  ].join("\n");
}

export const SCENE_SYSTEM = `You are a visual explainer writing ONE scene of an animated, narrated lesson, in the style of 3Blue1Brown. You produce a JSON scene spec that a renderer plays: elements appear and animate in sync with a voiceover.

## Narration rules
- 40–90 words of spoken, conversational English. No headers, no bullet points, no "in this scene". Write like you're talking to one curious person.
- Show, then tell: every claim in the narration must correspond to something appearing or changing on screen. If you can't visualize a sentence, rewrite it.
- Concrete before general: a specific number, curve, or example before the formula.
- Flow from the previous scene's last line — it will be given to you.

## Element rules
- 2–6 elements. The scene has a 12-column × 8-row grid on a 16:9 canvas; regions are {col,row,colSpan,rowSpan}. Prefer the layout presets: "split-lr" puts your big visual left (cols 0-6) and text/math right (cols 7-11).
- Give every element a short meaningful id ("graph", "eq", "cap").
- plot expressions use mathjs syntax in x: "x^2/4", "sin(x)", "2*x+1" (ALWAYS write explicit multiplication: "2*x" never "2x").
- math elements: split latex into "parts" when you want to reveal it piece by piece.
- code elements: define "highlights" line ranges you will light up while narrating them.
- diagram elements: just nodes and edges; layout is automatic.
- Do NOT use the image element unless nothing else can carry the idea (it renders as a placeholder).

## Beat rules (the choreography — this is what makes it feel alive)
- Introduce elements in the order the narration mentions them. Anchor each beat with "atWord": the exact word in the narration where it should fire (plus "at" as a fallback fraction 0..1).
- Every element needs an "enter" (or "draw" for plots/shapes) beat, EXCEPT a persistent backdrop element you want visible from the start.
- Use action "draw" with effect "draw-in" for curves and shapes; "reveal-part" for math parts (target "eq.partId"); "highlight" for code lines (target "code.hlId").
- Direct attention: "dim-others" on the thing being discussed, then "undim". "emphasize" for the single most important moment.
- Never more than 2 things animating at once. End the scene stable, with the key takeaway visible.

## Output
Return ONLY the JSON scene spec object. No markdown fences, no commentary.

## Example of a great scene spec
${JSON.stringify(fewShotScene, null, 1)}`;

export function sceneUser(args: {
  lessonTitle: string;
  audience: string;
  outline: string;
  sceneTitle: string;
  sceneGoal: string;
  visualIdea: string;
  sceneId: string;
  previousNarrationTail: string | null;
  researchNotes: string | null;
}) {
  return [
    `LESSON: ${args.lessonTitle} (audience: ${args.audience})`,
    `FULL OUTLINE:\n${args.outline}`,
    args.researchNotes ? `RESEARCH NOTES:\n${args.researchNotes}` : "",
    args.previousNarrationTail
      ? `PREVIOUS SCENE ENDED WITH: "…${args.previousNarrationTail}"`
      : "This is the first scene.",
    ``,
    `Write scene "${args.sceneTitle}" now.`,
    `Scene id must be: "${args.sceneId}"`,
    `Goal: ${args.sceneGoal}`,
    `Visual idea to execute: ${args.visualIdea}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function repairUser(
  originalJson: string,
  issues: { path: string; message: string }[]
) {
  return [
    `The scene spec you produced has validation errors. Fix them and return the corrected COMPLETE JSON object only — no commentary, no fences.`,
    ``,
    `ERRORS:`,
    ...issues.map((i) => `- at ${i.path}: ${i.message}`),
    ``,
    `YOUR PREVIOUS JSON:`,
    originalJson,
  ].join("\n");
}
