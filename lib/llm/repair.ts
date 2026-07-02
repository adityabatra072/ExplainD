import { generateText } from "ai";
import type { LanguageModel } from "ai";
import type { SceneSpecT } from "@/lib/spec/schema";
import { parseScene, salvageScene, lintScene } from "@/lib/spec/validate";
import { SceneSpec } from "@/lib/spec/schema";
import { repairUser } from "@/lib/pipeline/prompts";

export type SceneGenResult = {
  scene: SceneSpecT;
  repairCount: number;
  salvaged: boolean;
};

/** Strip markdown fences / stray prose around a JSON object. */
export function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text.trim();
}

/**
 * Validate-or-repair loop. One LLM output → parse; on failure, up to
 * `maxRepairs` targeted repair calls with the exact issues; final fallback
 * is deterministic salvage so a lesson never dies on one scene.
 */
export async function validateWithRepair(
  rawText: string,
  model: LanguageModel,
  maxRepairs = 2
): Promise<SceneGenResult> {
  let text = rawText;
  let repairCount = 0;

  for (;;) {
    let candidate: unknown;
    try {
      candidate = JSON.parse(extractJson(text));
    } catch (e) {
      if (repairCount >= maxRepairs) {
        throw new Error(`Scene JSON unparseable after ${repairCount} repairs: ${e}`);
      }
      repairCount++;
      const { text: fixed } = await generateText({
        model,
        prompt: repairUser(text.slice(0, 8000), [
          { path: "$", message: `Not valid JSON: ${e}` },
        ]),
      });
      text = fixed;
      continue;
    }

    const result = parseScene(candidate);
    if (result.ok) return { scene: result.scene, repairCount, salvaged: false };

    if (repairCount >= maxRepairs) {
      // Deterministic salvage: drop bad beats/arrows, clamp regions.
      const structural = SceneSpec.safeParse(candidate);
      if (structural.success) {
        const salvaged = salvageScene(structural.data);
        if (lintScene(salvaged).length === 0) {
          return { scene: salvaged, repairCount, salvaged: true };
        }
      }
      throw new Error(
        `Scene spec invalid after ${repairCount} repairs: ${result.issues
          .map((i) => `${i.path}: ${i.message}`)
          .join("; ")}`
      );
    }

    repairCount++;
    const { text: fixed } = await generateText({
      model,
      prompt: repairUser(JSON.stringify(candidate).slice(0, 8000), result.issues),
    });
    text = fixed;
  }
}
