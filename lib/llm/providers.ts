import type { ProviderId } from "@/lib/store/settings";

export type ProviderMeta = {
  id: ProviderId;
  label: string;
  needsApiKey: boolean;
  needsBaseUrl: boolean;
  keyPlaceholder?: string;
  defaultModels: string[];
  notes?: string;
};

/**
 * Model lists are suggestions for the settings UI — any model id typed by
 * the user is passed through verbatim.
 */
export const PROVIDERS: ProviderMeta[] = [
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    needsApiKey: true,
    needsBaseUrl: false,
    keyPlaceholder: "sk-ant-…",
    defaultModels: [
      "claude-sonnet-4-5",
      "claude-opus-4-1",
      "claude-haiku-4-5",
    ],
  },
  {
    id: "openai",
    label: "OpenAI",
    needsApiKey: true,
    needsBaseUrl: false,
    keyPlaceholder: "sk-…",
    defaultModels: ["gpt-5.2", "gpt-5-mini", "gpt-4.1"],
  },
  {
    id: "google",
    label: "Google (Gemini)",
    needsApiKey: true,
    needsBaseUrl: false,
    keyPlaceholder: "AIza…",
    defaultModels: ["gemini-2.5-pro", "gemini-2.5-flash"],
  },
  {
    id: "bedrock",
    label: "Amazon Bedrock",
    needsApiKey: false,
    needsBaseUrl: false,
    defaultModels: [
      "global.anthropic.claude-sonnet-4-6",
      "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
      "global.anthropic.claude-haiku-4-5-20251001-v1:0",
    ],
    notes: "Uses your AWS CLI credentials (aws configure). No key stored.",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    needsApiKey: true,
    needsBaseUrl: false,
    keyPlaceholder: "sk-or-…",
    defaultModels: [
      "anthropic/claude-sonnet-4.5",
      "openai/gpt-5.2",
      "google/gemini-2.5-pro",
      "meta-llama/llama-4-maverick",
    ],
  },
  {
    id: "ollama",
    label: "Ollama (local)",
    needsApiKey: false,
    needsBaseUrl: true,
    defaultModels: ["llama3.3", "qwen3:32b", "gemma3:27b"],
    notes: "Runs against your local Ollama server. Nothing leaves your machine.",
  },
  {
    id: "litellm",
    label: "LiteLLM proxy",
    needsApiKey: true,
    needsBaseUrl: true,
    keyPlaceholder: "sk-… (proxy key)",
    defaultModels: [],
    notes: "Point at any LiteLLM proxy for 100+ providers behind one URL.",
  },
];
