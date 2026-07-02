import { NextRequest, NextResponse } from "next/server";
import { deleteLesson, getLesson, getChatMessages } from "@/lib/store/lessons";
import { loadTimedScenes } from "@/lib/pipeline/generate";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const lesson = getLesson(id);
  if (!lesson) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    lesson,
    scenes: loadTimedScenes(id),
    chat: getChatMessages(id),
  });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  deleteLesson(id);
  return NextResponse.json({ ok: true });
}
