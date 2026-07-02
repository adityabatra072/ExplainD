import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { EdgeTTSAdapter } from "./edge";
import { OpenAITTSAdapter } from "./openai";
import { ElevenLabsTTSAdapter } from "./elevenlabs";
import type { TTSAdapter, TTSResult } from "./types";
import { getSettings } from "@/lib/store/settings";
import { AUDIO_DIR } from "@/lib/store/db";

/** Pick the configured engine; always fall back to free Edge TTS. */
export function getTTS(): TTSAdapter {
  const s = getSettings();
  switch (s.tts.engine) {
    case "openai": {
      const a = new OpenAITTSAdapter(s.tts.apiKeys.openai);
      if (a.isConfigured()) return a;
      break;
    }
    case "elevenlabs": {
      const a = new ElevenLabsTTSAdapter(s.tts.apiKeys.elevenlabs);
      if (a.isConfigured()) return a;
      break;
    }
  }
  return new EdgeTTSAdapter();
}

/**
 * Synthesize a scene's narration and cache it under .data/audio/.
 * Returns the public URL (served by /api/audio/[sceneId]) + timing data.
 */
export async function synthesizeSceneAudio(
  lessonId: string,
  sceneId: string,
  narration: string
): Promise<{ result: TTSResult; audioPath: string; audioUrl: string }> {
  const s = getSettings();
  const adapter = getTTS();
  const result = await adapter.synthesize(narration, s.tts.voice);

  const dir = path.join(AUDIO_DIR, lessonId);
  mkdirSync(dir, { recursive: true });
  const audioPath = path.join(dir, `${sceneId}.mp3`);
  writeFileSync(audioPath, result.audio);

  return { result, audioPath, audioUrl: `/api/audio/${lessonId}/${sceneId}` };
}
