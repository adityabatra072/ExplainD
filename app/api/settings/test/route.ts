import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { z } from "zod";
import { modelFor } from "@/lib/llm/registry";
import { getSettings, type ProviderId } from "@/lib/store/settings";

const Body = z.object({
  provider: z.enum(["anthropic", "openai", "google", "bedrock", "openrouter", "ollama", "litellm"]),
  model: z.string().min(1),
});

/** Smoke-test a provider config with a one-token completion. */
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { provider, model } = parsed.data;
  try {
    const s = getSettings();
    const t0 = Date.now();
    const { text } = await generateText({
      model: modelFor(provider as ProviderId, model, s),
      prompt: "Reply with the single word: ready",
    });
    return NextResponse.json({
      ok: true,
      reply: text.trim().slice(0, 40),
      ms: Date.now() - t0,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message.slice(0, 300) : String(e) },
      { status: 200 }
    );
  }
}
