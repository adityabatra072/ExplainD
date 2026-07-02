import type { WordTiming } from "@/lib/spec/schema";

export type TTSResult = {
  /** MP3 bytes. */
  audio: Buffer;
  /** Per-word timestamps; empty if the engine can't provide them. */
  wordTimings: WordTiming[];
  /** Duration of the audio in ms (from last word end, or estimated). */
  durationMs: number;
};

export interface TTSAdapter {
  readonly name: string;
  /** True when required config (API key etc.) is present. */
  isConfigured(): boolean;
  synthesize(text: string, voice?: string): Promise<TTSResult>;
  /** Voices the settings UI can offer. */
  voices(): { id: string; label: string }[];
}

/**
 * Fallback when an engine yields no word boundaries: allocate time
 * proportionally to word length. Sync degrades from word-exact to
 * word-approximate; the DSL and renderer don't change at all.
 */
export function estimateWordTimings(
  text: string,
  durationMs: number
): WordTiming[] {
  const words = text.split(/\s+/).filter(Boolean);
  const totalChars = words.reduce((n, w) => n + w.length + 1, 0);
  let cursor = 0;
  return words.map((word) => {
    const share = ((word.length + 1) / totalChars) * durationMs;
    const t = { word, offsetMs: cursor, durationMs: share };
    cursor += share;
    return t;
  });
}
