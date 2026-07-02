import { generateText } from "ai";
import { resolveModel } from "@/lib/llm/registry";
import { setSceneSummary, type SceneRow } from "@/lib/store/lessons";

/**
 * Context windowing for long sessions: scenes far from the playhead are
 * represented by cached 1-2 sentence summaries instead of full specs.
 */
export async function summarizeScene(
  lessonId: string,
  scene: SceneRow
): Promise<string> {
  if (scene.summary) return scene.summary;
  try {
    const { text } = await generateText({
      model: resolveModel(),
      prompt: `Summarize this lesson scene in 1-2 sentences (what was taught + what was shown on screen). Reply with the summary only.\n\nTITLE: ${scene.spec.title}\nNARRATION: ${scene.spec.narration}\nVISUALS: ${scene.spec.elements.map((e) => e.type).join(", ")}`,
    });
    const summary = text.trim().slice(0, 400);
    setSceneSummary(lessonId, scene.id, summary);
    return summary;
  } catch {
    // Cheap deterministic fallback.
    const fallback = `${scene.spec.title}: ${scene.spec.narration.slice(0, 140)}…`;
    return fallback;
  }
}
