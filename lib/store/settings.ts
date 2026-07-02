import { getDb } from "./db";

export type ProviderId =
  | "anthropic"
  | "openai"
  | "google"
  | "bedrock"
  | "openrouter"
  | "ollama"
  | "litellm";

export type Settings = {
  llm: {
    provider: ProviderId;
    model: string;
    /** Per-provider API keys — stored locally only, never committed/shipped. */
    apiKeys: Partial<Record<ProviderId, string>>;
    /** Base URLs for self-hosted endpoints (ollama, litellm). */
    baseUrls: Partial<Record<ProviderId, string>>;
    /** AWS region for Bedrock (credentials come from the AWS CLI chain). */
    bedrockRegion: string;
  };
  tts: {
    engine: "edge" | "openai" | "elevenlabs";
    voice: string;
    apiKeys: { openai?: string; elevenlabs?: string };
  };
  research: {
    enabled: "auto" | "always" | "off";
    exaApiKey?: string;
    perplexityApiKey?: string;
  };
};

export const DEFAULT_SETTINGS: Settings = {
  llm: {
    provider: "bedrock",
    model: "global.anthropic.claude-sonnet-4-6",
    apiKeys: {},
    baseUrls: {
      ollama: "http://localhost:11434/v1",
      litellm: "http://localhost:4000/v1",
    },
    bedrockRegion: "us-east-1",
  },
  tts: {
    engine: "edge",
    voice: "en-US-AndrewNeural",
    apiKeys: {},
  },
  research: { enabled: "auto" },
};

export function getSettings(): Settings {
  const row = getDb()
    .prepare("SELECT value_json FROM settings WHERE key = 'app'")
    .get() as { value_json: string } | undefined;
  if (!row) return structuredClone(DEFAULT_SETTINGS);
  const stored = JSON.parse(row.value_json) as Partial<Settings>;
  // Deep-ish merge so new default fields appear after upgrades.
  const d = structuredClone(DEFAULT_SETTINGS);
  return {
    llm: { ...d.llm, ...stored.llm, apiKeys: { ...d.llm.apiKeys, ...stored.llm?.apiKeys }, baseUrls: { ...d.llm.baseUrls, ...stored.llm?.baseUrls } },
    tts: { ...d.tts, ...stored.tts, apiKeys: { ...d.tts.apiKeys, ...stored.tts?.apiKeys } },
    research: { ...d.research, ...stored.research },
  };
}

export function saveSettings(settings: Settings): void {
  getDb()
    .prepare(
      "INSERT INTO settings (key, value_json) VALUES ('app', ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json"
    )
    .run(JSON.stringify(settings));
}

/** Mask a secret for display: keep first 3 + last 4 chars. */
export function maskKey(key: string | undefined): string | undefined {
  if (!key) return undefined;
  if (key.length <= 8) return "****";
  return `${key.slice(0, 3)}…${key.slice(-4)}`;
}
