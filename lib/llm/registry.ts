import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { getSettings, type ProviderId, type Settings } from "@/lib/store/settings";

/**
 * The single point where {provider, model, key, baseUrl} becomes a
 * LanguageModel. Everything upstream (pipeline, agent) is provider-blind.
 */
export function resolveModel(
  overrides?: Partial<{ provider: ProviderId; model: string }>
): LanguageModel {
  const s = getSettings();
  const provider = overrides?.provider ?? s.llm.provider;
  const model = overrides?.model ?? s.llm.model;
  return modelFor(provider, model, s);
}

export function modelFor(
  provider: ProviderId,
  model: string,
  s: Settings
): LanguageModel {
  switch (provider) {
    case "anthropic": {
      const key = s.llm.apiKeys.anthropic;
      if (!key) throw new ProviderNotConfigured("anthropic");
      return createAnthropic({ apiKey: key })(model);
    }
    case "openai": {
      const key = s.llm.apiKeys.openai;
      if (!key) throw new ProviderNotConfigured("openai");
      return createOpenAI({ apiKey: key })(model);
    }
    case "google": {
      const key = s.llm.apiKeys.google;
      if (!key) throw new ProviderNotConfigured("google");
      return createGoogleGenerativeAI({ apiKey: key })(model);
    }
    case "bedrock": {
      // Credentials come from the standard AWS chain (env, ~/.aws, SSO).
      return createAmazonBedrock({
        region: s.llm.bedrockRegion,
        credentialProvider: fromNodeProviderChain(),
      })(model);
    }
    case "openrouter": {
      const key = s.llm.apiKeys.openrouter;
      if (!key) throw new ProviderNotConfigured("openrouter");
      // OpenRouter speaks the OpenAI protocol; using the compatible
      // provider avoids a hard dependency on their SDK's ai@6 peer range.
      return createOpenAICompatible({
        name: "openrouter",
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: key,
      })(model);
    }
    case "ollama": {
      const baseURL = s.llm.baseUrls.ollama ?? "http://localhost:11434/v1";
      return createOpenAICompatible({
        name: "ollama",
        baseURL,
        apiKey: "ollama",
      })(model);
    }
    case "litellm": {
      const baseURL = s.llm.baseUrls.litellm;
      if (!baseURL) throw new ProviderNotConfigured("litellm");
      return createOpenAICompatible({
        name: "litellm",
        baseURL,
        apiKey: s.llm.apiKeys.litellm ?? "anything",
      })(model);
    }
  }
}

export class ProviderNotConfigured extends Error {
  constructor(provider: string) {
    super(
      `Provider "${provider}" has no API key configured. Add one in Settings.`
    );
    this.name = "ProviderNotConfigured";
  }
}
