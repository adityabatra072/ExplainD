import { streamText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { resolveModel } from "@/lib/llm/registry";
import { validateWithRepair } from "@/lib/llm/repair";
import { SCENE_SYSTEM } from "@/lib/pipeline/prompts";
import {
  addChatMessage,
  addScene,
  getChatMessages,
  getLesson,
  getScenes,
  orderKeyBetween,
  type SceneRow,
} from "@/lib/store/lessons";
import { summarizeScene } from "./memory";
import { synthesizeSceneAudio } from "@/lib/tts";
import { timeScene } from "@/lib/timeline";
import { research } from "@/lib/research";
import type { TimedScene } from "@/lib/spec/schema";

export type Playhead = {
  sceneId: string;
  sceneProgress: number;
  frame: number;
} | null;

export type TutorEvent =
  | { type: "text-delta"; text: string }
  | { type: "scenes-inserted"; afterSceneId: string | null; scenes: TimedScene[] }
  | { type: "seek"; sceneId: string }
  | { type: "done" }
  | { type: "error"; message: string };

const NEIGHBOR_WINDOW = 1;

/** Words of the active scene's narration spoken up to the playhead. */
function spokenSoFar(scene: SceneRow, progress: number): string {
  const totalMs = scene.durationMs || 1;
  const cutoffMs = progress * totalMs;
  const words = scene.wordTimings.filter((t) => t.offsetMs <= cutoffMs);
  if (words.length > 0) return words.map((w) => w.word).join(" ");
  // No timings: approximate by fraction of words.
  const all = scene.spec.narration.split(/\s+/);
  return all.slice(0, Math.floor(progress * all.length)).join(" ");
}

/** Elements whose enter beat fired before the playhead (and no exit yet). */
function visibleElements(scene: SceneRow, progress: number): string[] {
  const cutoffMs = progress * (scene.durationMs || 1);
  const entered = new Set<string>();
  const exited = new Set<string>();
  const timed = timeScene(scene.spec, null, scene.wordTimings, scene.durationMs);
  const hasEnterBeat = new Set(
    timed.resolvedBeats
      .filter((b) => ["enter", "draw", "reveal-part"].includes(b.action))
      .map((b) => b.target.split(".")[0])
  );
  for (const el of scene.spec.elements) {
    if (!hasEnterBeat.has(el.id)) entered.add(el.id); // visible from start
  }
  for (const b of timed.resolvedBeats) {
    if (b.atMs > cutoffMs) continue;
    const root = b.target.split(".")[0];
    if (["enter", "draw", "reveal-part"].includes(b.action)) entered.add(root);
    if (b.action === "exit") exited.add(root);
  }
  return [...entered].filter((id) => !exited.has(id));
}

async function buildContext(lessonId: string, playhead: Playhead) {
  const lesson = getLesson(lessonId);
  if (!lesson) throw new Error("lesson not found");
  const scenes = getScenes(lessonId);
  const activeIdx = playhead
    ? scenes.findIndex((s) => s.id === playhead.sceneId)
    : scenes.length - 1;

  const parts: string[] = [];
  parts.push(
    `LESSON: "${lesson.title}" (audience: ${lesson.audience})`,
    `Original request: ${lesson.prompt.slice(0, 500)}`,
    ``
  );

  if (lesson.outline) {
    parts.push(
      "OUTLINE:",
      ...lesson.outline.scenes.map((s, i) => `${i + 1}. ${s.title}`),
      ""
    );
  }

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const near = Math.abs(i - activeIdx) <= NEIGHBOR_WINDOW;
    if (near) {
      parts.push(
        `SCENE ${i + 1} [id=${scene.id}]${i === activeIdx ? " ← CURRENTLY ON SCREEN" : ""}: "${scene.spec.title}"`,
        `narration: ${scene.spec.narration}`,
        `spec: ${JSON.stringify({ layout: scene.spec.layout, elements: scene.spec.elements })}`,
        ""
      );
    } else {
      const summary = await summarizeScene(lessonId, scene);
      parts.push(`SCENE ${i + 1} [id=${scene.id}]: ${summary}`, "");
    }
  }

  if (playhead && activeIdx >= 0) {
    const active = scenes[activeIdx];
    const spoken = spokenSoFar(active, playhead.sceneProgress);
    const visible = visibleElements(active, playhead.sceneProgress);
    parts.push(
      `PLAYHEAD: ${Math.round(playhead.sceneProgress * 100)}% through scene ${activeIdx + 1}.`,
      `The learner has just heard: "…${spoken.split(/\s+/).slice(-30).join(" ")}"`,
      `Visible on screen right now: ${visible.join(", ") || "(nothing yet)"}`,
      ""
    );
  }

  return { lesson, scenes, activeIdx, contextText: parts.join("\n") };
}

const TUTOR_SYSTEM = `You are the tutor inside ExplainD, an animated lesson the learner is watching right now. You can see exactly where they are (scene, words just spoken, what's on screen). Your job: answer their question in the context of that moment.

How to respond:
- Answer conversationally in chat (markdown ok, keep it tight — 2 short paragraphs max).
- If the question deserves animation — a "show me", a misconception worth drawing, a worked example — call insert_scenes to add 1-2 new scenes right after the current one. Tell the learner you've added them ("I've added a scene showing…"). Scene ids MUST start with "ins-".
- If the answer was already covered visually in an earlier scene, call seek_to_scene with that scene's id and briefly say why you're taking them back.
- For questions about current/factual matters you're unsure of, call do_research first.
- Don't insert scenes for simple clarifications a sentence can handle. Never insert more than 2 scenes per question.

When writing inserted scenes, follow the same craft rules as the lesson itself (visual-first, 40-90 word narration, beats anchored with atWord).`;

/**
 * One tutor turn. Streams text deltas and tool events.
 */
export async function* tutorTurn(
  lessonId: string,
  userMessage: string,
  playhead: Playhead
): AsyncGenerator<TutorEvent> {
  const model = resolveModel();
  const { scenes, activeIdx, contextText } = await buildContext(
    lessonId,
    playhead
  );
  const history = getChatMessages(lessonId, 20);
  addChatMessage(lessonId, "user", userMessage);

  // Events produced inside tool executes, drained between stream parts.
  const pending: TutorEvent[] = [];
  const activeSceneId = activeIdx >= 0 ? scenes[activeIdx]?.id : null;

  const SceneDraft = z.object({
    scenes: z
      .array(z.record(z.string(), z.unknown()))
      .describe(
        "1-2 complete scene spec objects (same JSON format as the example in your instructions), ids starting with 'ins-'"
      ),
  });

  const tools = {
    insert_scenes: tool({
      description:
        "Insert 1-2 new animated scenes into the lesson immediately after the current scene. Use for visual answers.",
      inputSchema: SceneDraft,
      execute: async ({ scenes: drafts }) => {
        const inserted: TimedScene[] = [];
        const all = getScenes(lessonId);
        const anchorIdx = activeSceneId
          ? all.findIndex((s) => s.id === activeSceneId)
          : all.length - 1;
        let beforeKey = all[anchorIdx]?.orderKey ?? null;
        const afterKey = all[anchorIdx + 1]?.orderKey ?? null;

        for (const draft of drafts.slice(0, 2)) {
          const { scene } = await validateWithRepair(
            JSON.stringify(draft),
            model,
            1
          );
          if (!scene.id.startsWith("ins-")) {
            scene.id = `ins-${Date.now()}-${scene.id}`;
          }
          const { result, audioPath, audioUrl } = await synthesizeSceneAudio(
            lessonId,
            scene.id,
            scene.narration
          );
          const orderKey = orderKeyBetween(beforeKey, afterKey);
          beforeKey = orderKey;
          addScene({
            lessonId,
            orderKey,
            spec: scene,
            wordTimings: result.wordTimings,
            audioPath,
            durationMs: result.durationMs,
            inserted: true,
          });
          inserted.push(
            timeScene(scene, audioUrl, result.wordTimings, result.durationMs)
          );
        }
        pending.push({
          type: "scenes-inserted",
          afterSceneId: activeSceneId,
          scenes: inserted,
        });
        return `Inserted ${inserted.length} scene(s): ${inserted
          .map((s) => s.spec.title)
          .join(", ")}. They will play next.`;
      },
    }),
    seek_to_scene: tool({
      description:
        "Jump the player back (or forward) to an existing scene that already answers the question.",
      inputSchema: z.object({
        sceneId: z.string().describe("the scene id, e.g. scene-2"),
      }),
      execute: async ({ sceneId }) => {
        const exists = getScenes(lessonId).some((s) => s.id === sceneId);
        if (!exists) return `No scene with id ${sceneId}.`;
        pending.push({ type: "seek", sceneId });
        return `Player moved to ${sceneId}.`;
      },
    }),
    do_research: tool({
      description:
        "Search the web/Wikipedia for facts you are not sure about. Returns research notes.",
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }) => {
        const notes = await research(query);
        return notes ?? "No results found.";
      },
    }),
  };

  try {
    const result = streamText({
      model,
      system: `${TUTOR_SYSTEM}\n\n---- SCENE SPEC FORMAT REFERENCE ----\n${SCENE_SYSTEM.slice(SCENE_SYSTEM.indexOf("## Element rules"))}`,
      messages: [
        { role: "user" as const, content: `CONTEXT:\n${contextText}` },
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: userMessage },
      ],
      tools,
      stopWhen: stepCountIs(4),
    });

    let fullText = "";
    for await (const part of result.fullStream) {
      while (pending.length > 0) yield pending.shift()!;
      if (part.type === "text-delta") {
        fullText += part.text;
        yield { type: "text-delta", text: part.text };
      }
      if (part.type === "error") {
        throw part.error instanceof Error
          ? part.error
          : new Error(String(part.error));
      }
    }
    while (pending.length > 0) yield pending.shift()!;

    addChatMessage(lessonId, "assistant", fullText || "(action taken)");
    yield { type: "done" };
  } catch (e) {
    yield {
      type: "error",
      message: e instanceof Error ? e.message : String(e),
    };
  }
}
