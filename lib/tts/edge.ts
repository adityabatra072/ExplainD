import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import type { TTSAdapter, TTSResult } from "./types";
import { estimateWordTimings } from "./types";
import type { WordTiming } from "@/lib/spec/schema";

export const EDGE_VOICES = [
  { id: "en-US-AndrewNeural", label: "Andrew — warm male (US)" },
  { id: "en-US-AriaNeural", label: "Aria — expressive female (US)" },
  { id: "en-US-AvaNeural", label: "Ava — bright female (US)" },
  { id: "en-US-BrianNeural", label: "Brian — calm male (US)" },
  { id: "en-GB-RyanNeural", label: "Ryan — male (UK)" },
  { id: "en-GB-SoniaNeural", label: "Sonia — female (UK)" },
  { id: "en-IN-PrabhatNeural", label: "Prabhat — male (India)" },
  { id: "en-IN-NeerjaNeural", label: "Neerja — female (India)" },
];

export const DEFAULT_VOICE = "en-US-AndrewNeural";

/**
 * Free Microsoft Edge neural TTS. No API key. Emits WordBoundary events —
 * the backbone of beat-to-speech sync. Community-maintained endpoint:
 * isolate failures and let callers fall back gracefully.
 */
export class EdgeTTSAdapter implements TTSAdapter {
  readonly name = "edge";

  isConfigured(): boolean {
    return true;
  }

  voices() {
    return EDGE_VOICES;
  }

  async synthesize(text: string, voice = DEFAULT_VOICE): Promise<TTSResult> {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(
      voice,
      OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3,
      { wordBoundaryEnabled: true }
    );

    const { audioStream, metadataStream } = tts.toStream(text);
    const chunks: Buffer[] = [];
    const wordTimings: WordTiming[] = [];

    audioStream.on("data", (c: Buffer) => chunks.push(c));
    metadataStream?.on("data", (raw: Buffer | string) => {
      try {
        const meta = JSON.parse(raw.toString());
        for (const item of meta.Metadata ?? []) {
          if (item.Type === "WordBoundary") {
            wordTimings.push({
              word: item.Data.text.Text,
              // Edge reports offsets in 100-nanosecond ticks.
              offsetMs: item.Data.Offset / 10000,
              durationMs: item.Data.Duration / 10000,
            });
          }
        }
      } catch {
        // tolerate malformed metadata frames
      }
    });

    await new Promise<void>((resolve, reject) => {
      audioStream.on("end", resolve);
      audioStream.on("error", reject);
      // Belt-and-braces: the endpoint occasionally stalls.
      setTimeout(() => reject(new Error("edge-tts timeout")), 60_000);
    });

    const audio = Buffer.concat(chunks);
    if (audio.length < 200) {
      throw new Error("edge-tts returned empty audio");
    }

    const durationMs =
      wordTimings.length > 0
        ? Math.max(...wordTimings.map((t) => t.offsetMs + t.durationMs))
        : text.split(/\s+/).filter(Boolean).length * 380;

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
