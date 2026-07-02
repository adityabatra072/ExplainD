import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { AUDIO_DIR } from "@/lib/store/db";

/** Serve cached scene audio from .data/audio/{lessonId}/{sceneId}.mp3 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ lessonId: string; sceneId: string }> }
) {
  const { lessonId, sceneId } = await ctx.params;
  // Path traversal guard: ids are UUIDs/slugs, never path segments.
  if (!/^[\w-]+$/.test(lessonId) || !/^[\w-]+$/.test(sceneId)) {
    return new NextResponse("bad id", { status: 400 });
  }
  const file = path.join(AUDIO_DIR, lessonId, `${sceneId}.mp3`);
  if (!existsSync(file)) return new NextResponse("not found", { status: 404 });
  return new NextResponse(new Uint8Array(readFileSync(file)), {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
