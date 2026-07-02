import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { getLesson } from "@/lib/store/lessons";
import { loadTimedScenes } from "@/lib/pipeline/generate";

export const maxDuration = 900;

/**
 * Render the lesson to MP4 with @remotion/renderer. Heavy (headless
 * Chrome); imports are dynamic so the dev server doesn't pay for them.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const lesson = getLesson(id);
  if (!lesson) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (lesson.status !== "ready") {
    return NextResponse.json(
      { error: "lesson still generating" },
      { status: 409 }
    );
  }

  // The render browser resolves URLs against Remotion's bundle server, not
  // this app — audio URLs must be absolute.
  const origin = req.nextUrl.origin;
  const scenes = loadTimedScenes(id).map((s) => ({
    ...s,
    audioUrl: s.audioUrl ? `${origin}${s.audioUrl}` : null,
  }));
  if (scenes.length === 0) {
    return NextResponse.json({ error: "no scenes" }, { status: 409 });
  }

  const exportDir = path.join(process.cwd(), ".data", "exports");
  mkdirSync(exportDir, { recursive: true });
  const outPath = path.join(exportDir, `${id}.mp4`);

  try {
    const { bundle } = await import("@remotion/bundler");
    const { renderMedia, selectComposition } = await import(
      "@remotion/renderer"
    );

    const { webpackOverride } = await import("@/remotion/webpack-override");
    const serveUrl = await bundle({
      entryPoint: path.join(process.cwd(), "remotion", "index.ts"),
      webpackOverride,
    });

    const inputProps = { scenes };
    const composition = await selectComposition({
      serveUrl,
      id: "Lesson",
      inputProps,
    });

    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: outPath,
      inputProps,
    });

    const video = readFileSync(outPath);
    return new NextResponse(new Uint8Array(video), {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${sanitize(lesson.title || "lesson")}.mp4"`,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message.slice(0, 500) : String(e) },
      { status: 500 }
    );
  }
}

/** Cached export download if it exists. */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const outPath = path.join(process.cwd(), ".data", "exports", `${id}.mp4`);
  if (!existsSync(outPath)) {
    return NextResponse.json({ exists: false });
  }
  return NextResponse.json({ exists: true });
}

const sanitize = (s: string) => s.replace(/[^\w\s-]/g, "").slice(0, 60).trim();
