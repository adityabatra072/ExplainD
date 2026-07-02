import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTTS } from "@/lib/tts";
import { getSettings } from "@/lib/store/settings";

const Body = z.object({
  text: z.string().min(1).max(4000),
  voice: z.string().optional(),
});

/**
 * Ad-hoc TTS (voice-mode replies, voice previews). Returns MP3 with the
 * word timings in a header so the client can drive captions if wanted.
 */
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { text, voice } = parsed.data;
  try {
    const settings = getSettings();
    const result = await getTTS().synthesize(text, voice ?? settings.tts.voice);
    return new NextResponse(new Uint8Array(result.audio), {
      headers: {
        "Content-Type": "audio/mpeg",
        "X-Duration-Ms": String(Math.round(result.durationMs)),
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "tts failed" },
      { status: 502 }
    );
  }
}
