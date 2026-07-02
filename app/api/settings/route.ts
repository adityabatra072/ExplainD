import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getSettings,
  saveSettings,
  maskKey,
  type Settings,
} from "@/lib/store/settings";
import { PROVIDERS } from "@/lib/llm/providers";
import { EDGE_VOICES } from "@/lib/tts/edge";

/** GET returns settings with every secret masked. */
export async function GET() {
  const s = getSettings();
  return NextResponse.json({
    settings: {
      ...s,
      llm: {
        ...s.llm,
        apiKeys: Object.fromEntries(
          Object.entries(s.llm.apiKeys).map(([k, v]) => [k, maskKey(v)])
        ),
      },
      tts: {
        ...s.tts,
        apiKeys: {
          openai: maskKey(s.tts.apiKeys.openai),
          elevenlabs: maskKey(s.tts.apiKeys.elevenlabs),
        },
      },
      research: {
        ...s.research,
        exaApiKey: maskKey(s.research.exaApiKey),
        perplexityApiKey: maskKey(s.research.perplexityApiKey),
      },
    },
    providers: PROVIDERS,
    edgeVoices: EDGE_VOICES,
  });
}

const Patch = z.object({
  llm: z
    .object({
      provider: z.enum(["anthropic", "openai", "google", "bedrock", "openrouter", "ollama", "litellm"]).optional(),
      model: z.string().optional(),
      apiKeys: z.record(z.string(), z.string()).optional(),
      baseUrls: z.record(z.string(), z.string()).optional(),
      bedrockRegion: z.string().optional(),
    })
    .optional(),
  tts: z
    .object({
      engine: z.enum(["edge", "openai", "elevenlabs"]).optional(),
      voice: z.string().optional(),
      apiKeys: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
  research: z
    .object({
      enabled: z.enum(["auto", "always", "off"]).optional(),
      exaApiKey: z.string().optional(),
      perplexityApiKey: z.string().optional(),
    })
    .optional(),
});

/**
 * PUT merges a partial patch. Masked values (containing "…") are ignored so
 * the UI can echo masked keys back without wiping the stored secrets.
 */
export async function PUT(req: NextRequest) {
  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const patch = parsed.data;
  const current = getSettings();

  const cleanSecrets = (obj: Record<string, string> | undefined) => {
    if (!obj) return {};
    return Object.fromEntries(
      Object.entries(obj).filter(([, v]) => v && !v.includes("…") && v !== "****")
    );
  };

  const next: Settings = {
    llm: {
      ...current.llm,
      ...(patch.llm?.provider && { provider: patch.llm.provider }),
      ...(patch.llm?.model && { model: patch.llm.model }),
      ...(patch.llm?.bedrockRegion && { bedrockRegion: patch.llm.bedrockRegion }),
      apiKeys: { ...current.llm.apiKeys, ...cleanSecrets(patch.llm?.apiKeys) },
      baseUrls: { ...current.llm.baseUrls, ...patch.llm?.baseUrls },
    },
    tts: {
      ...current.tts,
      ...(patch.tts?.engine && { engine: patch.tts.engine }),
      ...(patch.tts?.voice && { voice: patch.tts.voice }),
      apiKeys: { ...current.tts.apiKeys, ...cleanSecrets(patch.tts?.apiKeys) },
    },
    research: {
      ...current.research,
      ...(patch.research?.enabled && { enabled: patch.research.enabled }),
      ...cleanSecrets({
        ...(patch.research?.exaApiKey !== undefined && {
          exaApiKey: patch.research.exaApiKey,
        }),
        ...(patch.research?.perplexityApiKey !== undefined && {
          perplexityApiKey: patch.research.perplexityApiKey,
        }),
      }),
    },
  };

  saveSettings(next);
  return NextResponse.json({ ok: true });
}
