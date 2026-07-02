import { NextRequest } from "next/server";
import { z } from "zod";
import { tutorTurn } from "@/lib/agent/tutor";
import { getLesson } from "@/lib/store/lessons";

export const maxDuration = 300;

const Body = z.object({
  message: z.string().min(1).max(4000),
  playhead: z
    .object({
      sceneId: z.string(),
      sceneProgress: z.number().min(0).max(1),
      frame: z.number(),
    })
    .nullable(),
});

/** One tutor turn, streamed as SSE (text deltas + tool events). */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  if (!getLesson(id)) return new Response("not found", { status: 404 });
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return new Response("invalid body", { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      try {
        for await (const event of tutorTurn(
          id,
          parsed.data.message,
          parsed.data.playhead
        )) {
          if (req.signal.aborted) break;
          send(event);
        }
      } catch (e) {
        send({
          type: "error",
          message: e instanceof Error ? e.message : String(e),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
