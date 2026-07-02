import { generateObject, generateText } from "ai";
import { z } from "zod";
import { resolveModel } from "@/lib/llm/registry";
import { validateWithRepair } from "@/lib/llm/repair";
import {
  OUTLINE_SYSTEM,
  SCENE_SYSTEM,
  outlineUser,
  sceneUser,
} from "./prompts";
import {
  addScene,
  getLesson,
  getScenes,
  updateLesson,
  type OutlineT,
} from "@/lib/store/lessons";
import { synthesizeSceneAudio } from "@/lib/tts";
import { maybeResearch } from "@/lib/research";
import { timeScene } from "@/lib/timeline";
import type { TimedScene } from "@/lib/spec/schema";

const OutlineSchema = z.object({
  title: z.string(),
  audience: z.string(),
  // NOTE: no .min()/.max() here — Bedrock's structured-output rejects
  // minItems > 1. The outline prompt enforces 4–8 scenes instead.
  scenes: z.array(
    z.object({
      title: z.string(),
      goal: z.string(),
      visualIdea: z.string(),
    })
  ),
});

export type GenEvent =
  | { type: "status"; message: string }
  | { type: "outline"; outline: OutlineT; title: string }
  | { type: "scene"; scene: TimedScene; index: number; total: number }
  | { type: "done" }
  | { type: "error"; message: string };

/**
 * The lesson orchestrator. Yields events consumed by the SSE route so the
 * client can start playback after scene 1 while the rest generates.
 */
export async function* generateLesson(
  lessonId: string
): AsyncGenerator<GenEvent> {
  const lesson = getLesson(lessonId);
  if (!lesson) {
    yield { type: "error", message: "lesson not found" };
    return;
  }

  try {
    const model = resolveModel();

    // 1. Optional research (heuristic or user toggle decides).
    yield { type: "status", message: "Reading up on the topic…" };
    const researchNotes = await maybeResearch(lesson.prompt);

    // 2. Outline.
    yield { type: "status", message: "Designing the lesson…" };
    const { object: outlineRaw } = await generateObject({
      model,
      schema: OutlineSchema,
      system: OUTLINE_SYSTEM,
      prompt: outlineUser(lesson.prompt, researchNotes),
    });

    const outline: OutlineT = {
      title: outlineRaw.title,
      audience: outlineRaw.audience,
      scenes: outlineRaw.scenes.map((s, i) => ({
        id: `scene-${i + 1}`,
        ...s,
      })),
    };
    updateLesson(lessonId, {
      title: outline.title,
      audience: outline.audience,
      outline,
    });
    yield { type: "outline", outline, title: outline.title };

    const outlineText = outline.scenes
      .map((s, i) => `${i + 1}. ${s.title} — ${s.goal}`)
      .join("\n");

    // 3. Scenes, sequentially for narrative continuity.
    let previousTail: string | null = null;
    for (let i = 0; i < outline.scenes.length; i++) {
      const item = outline.scenes[i];
      yield {
        type: "status",
        message: `Animating scene ${i + 1} of ${outline.scenes.length}: ${item.title}`,
      };

      const { text } = await generateText({
        model,
        system: SCENE_SYSTEM,
        prompt: sceneUser({
          lessonTitle: outline.title,
          audience: outline.audience,
          outline: outlineText,
          sceneTitle: item.title,
          sceneGoal: item.goal,
          visualIdea: item.visualIdea,
          sceneId: item.id,
          previousNarrationTail: previousTail,
          researchNotes,
        }),
      });

      const { scene, repairCount } = await validateWithRepair(text, model);
      // The model sometimes renames the id; enforce outline's id.
      scene.id = item.id;
      previousTail = scene.narration.split(/\s+/).slice(-14).join(" ");

      // 4. Voice it.
      const { result, audioPath, audioUrl } = await synthesizeSceneAudio(
        lessonId,
        scene.id,
        scene.narration
      );

      addScene({
        lessonId,
        orderKey: i + 1,
        spec: scene,
        wordTimings: result.wordTimings,
        audioPath,
        durationMs: result.durationMs,
        repairCount,
      });

      yield {
        type: "scene",
        scene: timeScene(scene, audioUrl, result.wordTimings, result.durationMs),
        index: i,
        total: outline.scenes.length,
      };
    }

    updateLesson(lessonId, { status: "ready" });
    yield { type: "done" };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    updateLesson(lessonId, { status: "error", error: message });
    yield { type: "error", message };
  }
}

/** Rebuild TimedScenes for an existing lesson (page reload). */
export function loadTimedScenes(lessonId: string): TimedScene[] {
  return getScenes(lessonId).map((row) =>
    timeScene(
      row.spec,
      row.audioPath ? `/api/audio/${lessonId}/${row.spec.id}` : null,
      row.wordTimings,
      row.durationMs || undefined
    )
  );
}
