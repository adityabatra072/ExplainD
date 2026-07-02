import { NextRequest } from "next/server";
import { generateLesson } from "@/lib/pipeline/generate";
import { getLesson } from "@/lib/store/lessons";

export const maxDuration = 600;

/**
 * SSE: runs the generation pipeline and streams events (status, outline,
 * scene, done, error). The client starts playback on the first `scene`.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const lesson = getLesson(id);
  if (!lesson) return new Response("not found", { status: 404 });
  if (lesson.status !== "generating") {
    // Already generated (page reload) — client should GET the lesson instead.
    return new Response(
      `data: ${JSON.stringify({ type: "done" })}\n\n`,
      { headers: SSE_HEADERS }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      try {
        for await (const event of generateLesson(id)) {
          if (req.signal.aborted) break;
          send(event);
        }
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : String(e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
};
