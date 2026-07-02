/**
 * QA: run the full generation pipeline (Bedrock by default) on N topics
 * and report per-scene validation/repair stats.
 * Run: npx tsx scripts/qa-pipeline.ts [--quick]
 */
import { createLesson } from "@/lib/store/lessons";
import { generateLesson } from "@/lib/pipeline/generate";

const TOPICS = [
  { prompt: "explain binary search to a 12 year old", audience: "kid" },
  { prompt: "Why does e^(i*pi) = -1? I know basic calculus.", audience: "undergrad" },
  {
    prompt:
      "teach me how TCP congestion control works, I'm a backend dev who never took networking",
    audience: "professional",
  },
  { prompt: "the French Revolution: causes and how it spiraled", audience: "general" },
  {
    prompt:
      "Notes from my bio class: 'photosynthesis light reactions vs Calvin cycle, chlorophyll absorbs red/blue, ATP + NADPH produced in thylakoid, sugar made in stroma'. Make this make sense.",
    audience: "high-school",
  },
];

async function runOne(prompt: string, audience: string) {
  const lesson = createLesson(prompt, audience);
  const stats = {
    prompt: prompt.slice(0, 50),
    scenes: 0,
    repairs: 0,
    salvaged: 0,
    error: null as string | null,
    beatsPerScene: [] as number[],
    elemsPerScene: [] as number[],
    ms: 0,
  };
  const t0 = Date.now();
  for await (const ev of generateLesson(lesson.id)) {
    if (ev.type === "scene") {
      stats.scenes++;
      stats.beatsPerScene.push(ev.scene.spec.beats.length);
      stats.elemsPerScene.push(ev.scene.spec.elements.length);
      process.stdout.write(
        `  scene ${ev.index + 1}/${ev.total}: "${ev.scene.spec.title}" — ${ev.scene.spec.elements.length} elems, ${ev.scene.spec.beats.length} beats, ${Math.round(ev.scene.durationMs / 1000)}s audio\n`
      );
    } else if (ev.type === "status") {
      process.stdout.write(`  [${ev.message}]\n`);
    } else if (ev.type === "outline") {
      process.stdout.write(`  OUTLINE: ${ev.title} (${ev.outline.scenes.length} scenes)\n`);
    } else if (ev.type === "error") {
      stats.error = ev.message;
    }
  }
  stats.ms = Date.now() - t0;
  return { lessonId: lesson.id, stats };
}

async function main() {
  const quick = process.argv.includes("--quick");
  const topics = quick ? TOPICS.slice(0, 1) : TOPICS;
  const all = [];
  for (const t of topics) {
    console.log(`\n=== ${t.prompt.slice(0, 70)} ===`);
    const r = await runOne(t.prompt, t.audience);
    all.push(r);
    console.log(
      r.stats.error
        ? `  FAILED: ${r.stats.error}`
        : `  OK: ${r.stats.scenes} scenes in ${Math.round(r.stats.ms / 1000)}s → lesson ${r.lessonId}`
    );
  }
  console.log("\n──── SUMMARY ────");
  for (const r of all) {
    console.log(
      `${r.stats.error ? "✗" : "✓"} ${r.stats.prompt} | scenes=${r.stats.scenes} avgBeats=${avg(r.stats.beatsPerScene)} avgElems=${avg(r.stats.elemsPerScene)} time=${Math.round(r.stats.ms / 1000)}s${r.stats.error ? " ERROR=" + r.stats.error : ""}`
    );
  }
  const failures = all.filter((r) => r.stats.error).length;
  process.exit(failures > 0 ? 1 : 0);
}

const avg = (a: number[]) =>
  a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : "0";

main();
