import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createLesson, listLessons } from "@/lib/store/lessons";

const Body = z.object({
  prompt: z.string().min(3).max(20_000),
  audience: z.string().max(200).default("general"),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const lesson = createLesson(parsed.data.prompt, parsed.data.audience);
  return NextResponse.json({ id: lesson.id });
}

export async function GET() {
  return NextResponse.json({ lessons: listLessons() });
}
