import type { TTSAdapter, TTSResult } from "./types";
import { estimateWordTimings } from "./types";

const OPENAI_VOICES = [
  { id: "alloy", label: "Alloy" },
  { id: "echo", label: "Echo" },
  { id: "fable", label: "Fable" },
  { id: "onyx", label: "Onyx" },
  { id: "nova", label: "Nova" },
  { id: "shimmer", label: "Shimmer" },
];

/**
 * OpenAI TTS (paid upgrade). No word timestamps from the API, so timings
 * are estimated proportionally — sync is approximate but serviceable.
 */
export class OpenAITTSAdapter implements TTSAdapter {
  readonly name = "openai";

  constructor(private apiKey: string | undefined) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  voices() {
    return OPENAI_VOICES;
  }

  async synthesize(text: string, voice = "alloy"): Promise<TTSResult> {
    if (!this.apiKey) throw new Error("OpenAI TTS: no API key configured");
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        input: text,
        voice,
        response_format: "mp3",
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI TTS failed: ${res.status} ${await res.text()}`);
    }
    const audio = Buffer.from(await res.arrayBuffer());
    // ~165 wpm speaking rate estimate.
    const words = text.split(/\s+/).filter(Boolean).length;
    const durationMs = (words / 165) * 60_000;
    return {
      audio,
      wordTimings: estimateWordTimings(text, durationMs),
      durationMs,
    };
  }
}
