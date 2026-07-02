import type {
  BeatT,
  SceneSpecT,
  TimedScene,
  WordTiming,
} from "./spec/schema";

export const FPS = 30;
/** Silence after the last spoken word so scenes don't cut off abruptly. */
export const SCENE_TAIL_MS = 900;
/** Fallback pacing when a scene has no audio yet (word count based). */
const FALLBACK_MS_PER_WORD = 380;

const clean = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/**
 * Resolve a beat's `at`/`atWord` anchor to absolute ms within the scene,
 * using per-word TTS timestamps. `atWord` wins over `at` when present.
 * With no timings, fall back to a proportional estimate over the narration.
 */
export function resolveBeatMs(
  beat: BeatT,
  narration: string,
  timings: WordTiming[],
  durationMs: number
): number {
  if (timings.length > 0) {
    if (beat.atWord) {
      const needle = clean(beat.atWord);
      const hit = timings.find((t) => clean(t.word) === needle);
      if (hit) return hit.offsetMs;
    }
    const idx = Math.min(
      timings.length - 1,
      Math.round(beat.at * (timings.length - 1))
    );
    return timings[idx].offsetMs;
  }
  // No audio: estimate from word position in the narration text.
  const words = narration.split(/\s+/).filter(Boolean);
  let frac = beat.at;
  if (beat.atWord) {
    const needle = clean(beat.atWord);
    const i = words.findIndex((w) => clean(w) === needle);
    if (i >= 0) frac = words.length > 1 ? i / (words.length - 1) : 0;
  }
  return frac * Math.max(0, durationMs - SCENE_TAIL_MS);
}

/**
 * Build a playback-ready TimedScene from a spec plus (optional) TTS output.
 */
export function timeScene(
  spec: SceneSpecT,
  audioUrl: string | null,
  wordTimings: WordTiming[],
  audioDurationMs?: number
): TimedScene {
  const lastWordEnd =
    wordTimings.length > 0
      ? Math.max(...wordTimings.map((t) => t.offsetMs + t.durationMs))
      : 0;
  const spokenMs =
    audioDurationMs ??
    (lastWordEnd > 0
      ? lastWordEnd
      : spec.narration.split(/\s+/).filter(Boolean).length *
        FALLBACK_MS_PER_WORD);
  const durationMs = Math.max(2000, spokenMs + SCENE_TAIL_MS);

  const resolvedBeats = spec.beats
    .map((b) => ({
      ...b,
      atMs: resolveBeatMs(b, spec.narration, wordTimings, durationMs),
    }))
    .sort((a, b) => a.atMs - b.atMs);

  return { spec, audioUrl, wordTimings, durationMs, resolvedBeats };
}

export type FrameMap = {
  fps: number;
  totalDurationInFrames: number;
  scenes: {
    sceneId: string;
    fromFrame: number;
    durationInFrames: number;
  }[];
};

export const msToFrames = (ms: number) => Math.max(1, Math.round((ms / 1000) * FPS));

/** Cumulative frame offsets for an ordered list of timed scenes. */
export function buildFrameMap(scenes: TimedScene[]): FrameMap {
  let cursor = 0;
  const entries = scenes.map((s) => {
    const durationInFrames = msToFrames(s.durationMs);
    const entry = {
      sceneId: s.spec.id,
      fromFrame: cursor,
      durationInFrames,
    };
    cursor += durationInFrames;
    return entry;
  });
  return {
    fps: FPS,
    totalDurationInFrames: Math.max(1, cursor),
    scenes: entries,
  };
}

/** Locate the active scene + progress for an absolute frame (player state → agent context). */
export function locateFrame(
  map: FrameMap,
  frame: number
): { sceneId: string; sceneProgress: number; offsetInSceneFrames: number } | null {
  for (const s of map.scenes) {
    if (frame >= s.fromFrame && frame < s.fromFrame + s.durationInFrames) {
      const offset = frame - s.fromFrame;
      return {
        sceneId: s.sceneId,
        sceneProgress: offset / s.durationInFrames,
        offsetInSceneFrames: offset,
      };
    }
  }
  const last = map.scenes[map.scenes.length - 1];
  if (!last) return null;
  return {
    sceneId: last.sceneId,
    sceneProgress: 1,
    offsetInSceneFrames: last.durationInFrames - 1,
  };
}
