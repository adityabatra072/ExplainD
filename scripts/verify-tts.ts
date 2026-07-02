/**
 * QA script: verify msedge-tts synthesizes audio AND emits WordBoundary
 * metadata. Run: npx tsx scripts/verify-tts.ts
 */
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { writeFileSync, mkdirSync } from "node:fs";

const TEXT =
  "Here's a curve. At any point on it, we can ask a simple question: how steep is it, right here?";

async function main() {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(
    "en-US-AndrewNeural",
    OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3,
    { wordBoundaryEnabled: true }
  );

  const { audioStream, metadataStream } = tts.toStream(TEXT);

  const audioChunks: Buffer[] = [];
  const words: { word: string; offsetMs: number; durationMs: number }[] = [];

  audioStream.on("data", (c: Buffer) => audioChunks.push(c));
  if (metadataStream) {
    metadataStream.on("data", (raw: Buffer | string) => {
      try {
        const meta = JSON.parse(raw.toString());
        for (const item of meta.Metadata ?? []) {
          if (item.Type === "WordBoundary") {
            words.push({
              word: item.Data.text.Text,
              offsetMs: item.Data.Offset / 10000,
              durationMs: item.Data.Duration / 10000,
            });
          }
        }
      } catch (e) {
        console.error("metadata parse error:", e);
      }
    });
  } else {
    console.error("NO METADATA STREAM — WordBoundary unavailable");
  }

  await new Promise<void>((resolve, reject) => {
    audioStream.on("end", resolve);
    audioStream.on("error", reject);
  });

  const audio = Buffer.concat(audioChunks);
  mkdirSync(".data", { recursive: true });
  writeFileSync(".data/tts-verify.mp3", audio);

  console.log(`audio bytes: ${audio.length}`);
  console.log(`words captured: ${words.length}`);
  console.log(
    `text word count: ${TEXT.split(/\s+/).filter(Boolean).length}`
  );
  console.log("first 5:", JSON.stringify(words.slice(0, 5), null, 1));
  console.log("last:", JSON.stringify(words[words.length - 1]));

  if (audio.length < 1000) throw new Error("FAIL: audio too small");
  if (words.length < 10) throw new Error("FAIL: too few word boundaries");
  console.log("\nVERIFY OK — msedge-tts works with WordBoundary metadata");
  process.exit(0);
}

main().catch((e) => {
  console.error("VERIFY FAILED:", e);
  process.exit(1);
});
