import type { TTSAdapter, TTSResult } from "./types";
import { estimateWordTimings } from "./types";
import type { WordTiming } from "@/lib/spec/schema";

const ELEVEN_VOICES = [
  { id: "JBFqnCBsd6RMkjVDRZzb", label: "George — narration" },
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah — soft" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", label: "Liam — energetic" },
  { id: "pFZP5JQG7iQjIQuC4Bku", label: "Lily — clear" },
];

/**
 * ElevenLabs (paid upgrade). Uses the with-timestamps endpoint and
 * aggregates character alignments into word timings — word-exact sync.
 */
export class ElevenLabsTTSAdapter implements TTSAdapter {
  readonly name = "elevenlabs";

  constructor(private apiKey: string | undefined) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  voices() {
    return ELEVEN_VOICES;
  }

  async synthesize(
    text: string,
    voice = ELEVEN_VOICES[0].id
  ): Promise<TTSResult> {
    if (!this.apiKey) throw new Error("ElevenLabs: no API key configured");
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps`,
      {
        method: "POST",
        headers: {
          "xi-api-key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
        }),
      }
    );
    if (!res.ok) {
      throw new Error(`ElevenLabs failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as {
      audio_base64: string;
      alignment?: {
        characters: string[];
        character_start_times_seconds: number[];
        character_end_times_seconds: number[];
      };
    };
    const audio = Buffer.from(data.audio_base64, "base64");

    let wordTimings: WordTiming[] = [];
    if (data.alignment) {
      wordTimings = alignmentToWords(data.alignment);
    }
    const durationMs =
      wordTimings.length > 0
        ? Math.max(...wordTimings.map((t) => t.offsetMs + t.durationMs))
        : (text.split(/\s+/).filter(Boolean).length / 165) * 60_000;

    return {
      audio,
      wordTimings:
        wordTimings.length > 0
          ? wordTimings
          : estimateWordTimings(text, durationMs),
      durationMs,
    };
  }
}

function alignmentToWords(alignment: {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}): WordTiming[] {
  const words: WordTiming[] = [];
  let current = "";
  let start = 0;
  let end = 0;
  alignment.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      if (current) {
        words.push({
          word: current,
          offsetMs: start * 1000,
          durationMs: Math.max(1, (end - start) * 1000),
        });
        current = "";
      }
      return;
    }
    if (!current) start = alignment.character_start_times_seconds[i];
    current += ch;
    end = alignment.character_end_times_seconds[i];
  });
  if (current) {
    words.push({
      word: current,
      offsetMs: start * 1000,
      durationMs: Math.max(1, (end - start) * 1000),
    });
  }
  return words;
}
