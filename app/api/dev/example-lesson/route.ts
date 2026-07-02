import { NextResponse } from "next/server";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { derivativeLesson } from "@/lib/spec/examples";
import { synthesizeSceneAudio } from "@/lib/tts";
import { timeScene } from "@/lib/timeline";
import { AUDIO_DIR } from "@/lib/store/db";
import type { TimedScene, WordTiming } from "@/lib/spec/schema";

const LESSON_ID = "example-derivative";

/**
 * Dev/QA: synthesize the hand-written example lesson with real TTS and
 * return playable TimedScenes. Audio + timings cached in .data/.
 */
export async function GET() {
  const scenes: TimedScene[] = [];
  for (const spec of derivativeLesson.scenes) {
    const dir = path.join(AUDIO_DIR, LESSON_ID);
    const audioFile = path.join(dir, `${spec.id}.mp3`);
    const timingsFile = path.join(dir, `${spec.id}.timings.json`);

    let wordTimings: WordTiming[];
    let durationMs: number;

    if (existsSync(audioFile) && existsSync(timingsFile)) {
      const cached = JSON.parse(readFileSync(timingsFile, "utf8"));
      wordTimings = cached.wordTimings;
      durationMs = cached.durationMs;
    } else {
      const { result } = await synthesizeSceneAudio(
        LESSON_ID,
        spec.id,
        spec.narration
      );
      wordTimings = result.wordTimings;
      durationMs = result.durationMs;
      mkdirSync(dir, { recursive: true });
      writeFileSync(timingsFile, JSON.stringify({ wordTimings, durationMs }));
    }

    scenes.push(
      timeScene(spec, `/api/audio/${LESSON_ID}/${spec.id}`, wordTimings, durationMs)
    );
  }
  return NextResponse.json({ title: derivativeLesson.title, scenes });
}
