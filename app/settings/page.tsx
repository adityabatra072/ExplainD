"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ProviderMeta = {
  id: string;
  label: string;
  needsApiKey: boolean;
  needsBaseUrl: boolean;
  keyPlaceholder?: string;
  defaultModels: string[];
  notes?: string;
};

type SettingsShape = {
  llm: {
    provider: string;
    model: string;
    apiKeys: Record<string, string | undefined>;
    baseUrls: Record<string, string | undefined>;
    bedrockRegion: string;
  };
  tts: {
    engine: string;
    voice: string;
    apiKeys: { openai?: string; elevenlabs?: string };
  };
  research: {
    enabled: string;
    exaApiKey?: string;
    perplexityApiKey?: string;
  };
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsShape | null>(null);
  const [providers, setProviders] = useState<ProviderMeta[]>([]);
  const [edgeVoices, setEdgeVoices] = useState<{ id: string; label: string }[]>([]);
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        setSettings(d.settings);
        setProviders(d.providers);
        setEdgeVoices(d.edgeVoices);
      });
  }, []);

  if (!settings) {
    return (
      <main className="flex-1 flex items-center justify-center text-ink-faint font-serif italic">
        loading…
      </main>
    );
  }

  const active = providers.find((p) => p.id === settings.llm.provider);

  const save = async (patch: Partial<SettingsShape>) => {
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const update = (fn: (s: SettingsShape) => SettingsShape) => {
    setSettings((s) => (s ? fn(s) : s));
  };

  const testProvider = async () => {
    setTesting(true);
    setTestResult(null);
    // Persist current form first so the test uses fresh keys.
    await save(settings);
    const res = await fetch("/api/settings/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: settings.llm.provider,
        model: settings.llm.model,
      }),
    });
    const d = await res.json();
    setTestResult(
      d.ok ? `✓ "${d.reply}" in ${d.ms}ms` : `✗ ${d.error}`
    );
    setTesting(false);
  };

  const previewVoice = async () => {
    setPreviewBusy(true);
    try {
      await save(settings);
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "Here's how I'll sound narrating your lessons.",
          voice: settings.tts.voice,
        }),
      });
      if (res.ok) {
        const blob = await res.blob();
        new Audio(URL.createObjectURL(blob)).play();
      }
    } finally {
      setPreviewBusy(false);
    }
  };

  return (
    <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-10">
      <header className="flex items-baseline justify-between mb-10">
        <div>
          <Link href="/" className="font-serif text-lg text-ink-dim hover:text-ink">
            Explain<span className="text-accent">D</span>
          </Link>
          <h1 className="font-serif text-3xl mt-2">Settings</h1>
        </div>
        <span
          className={`text-xs font-mono transition-opacity ${saved ? "opacity-100 text-secondary" : "opacity-0"}`}
        >
          saved
        </span>
      </header>

      {/* ── Model ─────────────────────────────────────── */}
      <Section
        title="Model"
        sub="Every provider works with the same engine. Keys are stored in a local database (.data/) that never leaves your machine."
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
          {providers.map((p) => (
            <button
              key={p.id}
              onClick={() =>
                update((s) => ({
                  ...s,
                  llm: {
                    ...s.llm,
                    provider: p.id,
                    model: p.defaultModels[0] ?? s.llm.model,
                  },
                }))
              }
              className={`px-3 py-2 border text-sm text-left transition-colors ${
                settings.llm.provider === p.id
                  ? "border-accent/70 bg-accent-dim text-ink"
                  : "border-hairline text-ink-dim hover:border-hairline-strong"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {active?.notes && (
          <p className="text-xs text-ink-faint mb-4">{active.notes}</p>
        )}

        <Field label="Model id">
          <input
            value={settings.llm.model}
            onChange={(e) =>
              update((s) => ({ ...s, llm: { ...s.llm, model: e.target.value } }))
            }
            list="model-suggestions"
            className={inputCls}
            placeholder="model id"
          />
          <datalist id="model-suggestions">
            {active?.defaultModels.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </Field>

        {active?.needsApiKey && (
          <Field label={`${active.label} API key`}>
            <input
              type="password"
              value={settings.llm.apiKeys[active.id] ?? ""}
              onChange={(e) =>
                update((s) => ({
                  ...s,
                  llm: {
                    ...s.llm,
                    apiKeys: { ...s.llm.apiKeys, [active.id]: e.target.value },
                  },
                }))
              }
              placeholder={active.keyPlaceholder}
              className={inputCls}
              autoComplete="off"
            />
          </Field>
        )}

        {active?.needsBaseUrl && (
          <Field label="Base URL">
            <input
              value={settings.llm.baseUrls[active.id] ?? ""}
              onChange={(e) =>
                update((s) => ({
                  ...s,
                  llm: {
                    ...s.llm,
                    baseUrls: { ...s.llm.baseUrls, [active.id]: e.target.value },
                  },
                }))
              }
              className={inputCls}
              placeholder="http://localhost:11434/v1"
            />
          </Field>
        )}

        {settings.llm.provider === "bedrock" && (
          <Field label="AWS region">
            <input
              value={settings.llm.bedrockRegion}
              onChange={(e) =>
                update((s) => ({
                  ...s,
                  llm: { ...s.llm, bedrockRegion: e.target.value },
                }))
              }
              className={inputCls}
            />
          </Field>
        )}

        <div className="flex items-center gap-3 mt-4">
          <button onClick={() => save(settings)} className={btnCls}>
            Save
          </button>
          <button onClick={testProvider} disabled={testing} className={btnCls}>
            {testing ? "testing…" : "Test connection"}
          </button>
          {testResult && (
            <span
              className={`text-xs font-mono ${testResult.startsWith("✓") ? "text-secondary" : "text-red-400"}`}
            >
              {testResult}
            </span>
          )}
        </div>
      </Section>

      {/* ── Voice ─────────────────────────────────────── */}
      <Section
        title="Voice"
        sub="Edge neural voices are free and word-sync exact. OpenAI / ElevenLabs are optional upgrades."
      >
        <div className="flex gap-2 mb-4">
          {(["edge", "openai", "elevenlabs"] as const).map((engine) => (
            <button
              key={engine}
              onClick={() =>
                update((s) => ({ ...s, tts: { ...s.tts, engine } }))
              }
              className={`px-3 py-1.5 border text-sm transition-colors ${
                settings.tts.engine === engine
                  ? "border-accent/70 bg-accent-dim text-ink"
                  : "border-hairline text-ink-dim hover:border-hairline-strong"
              }`}
            >
              {engine === "edge" ? "Edge (free)" : engine}
            </button>
          ))}
        </div>

        {settings.tts.engine === "edge" && (
          <Field label="Voice">
            <select
              value={settings.tts.voice}
              onChange={(e) =>
                update((s) => ({ ...s, tts: { ...s.tts, voice: e.target.value } }))
              }
              className={inputCls}
            >
              {edgeVoices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </Field>
        )}

        {settings.tts.engine === "openai" && (
          <Field label="OpenAI API key (TTS)">
            <input
              type="password"
              value={settings.tts.apiKeys.openai ?? ""}
              onChange={(e) =>
                update((s) => ({
                  ...s,
                  tts: {
                    ...s.tts,
                    apiKeys: { ...s.tts.apiKeys, openai: e.target.value },
                  },
                }))
              }
              className={inputCls}
              autoComplete="off"
            />
          </Field>
        )}

        {settings.tts.engine === "elevenlabs" && (
          <Field label="ElevenLabs API key">
            <input
              type="password"
              value={settings.tts.apiKeys.elevenlabs ?? ""}
              onChange={(e) =>
                update((s) => ({
                  ...s,
                  tts: {
                    ...s.tts,
                    apiKeys: { ...s.tts.apiKeys, elevenlabs: e.target.value },
                  },
                }))
              }
              className={inputCls}
              autoComplete="off"
            />
          </Field>
        )}

        <div className="flex gap-3 mt-4">
          <button onClick={() => save(settings)} className={btnCls}>
            Save
          </button>
          <button onClick={previewVoice} disabled={previewBusy} className={btnCls}>
            {previewBusy ? "…" : "► Preview voice"}
          </button>
        </div>
      </Section>

      {/* ── Research ──────────────────────────────────── */}
      <Section
        title="Research"
        sub="Fact-checking for topical lessons. Wikipedia and DuckDuckGo are free and keyless; Exa or Perplexity improve quality."
      >
        <div className="flex gap-2 mb-4">
          {(["auto", "always", "off"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() =>
                update((s) => ({
                  ...s,
                  research: { ...s.research, enabled: mode },
                }))
              }
              className={`px-3 py-1.5 border text-sm transition-colors ${
                settings.research.enabled === mode
                  ? "border-accent/70 bg-accent-dim text-ink"
                  : "border-hairline text-ink-dim hover:border-hairline-strong"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
        <Field label="Exa API key (optional)">
          <input
            type="password"
            value={settings.research.exaApiKey ?? ""}
            onChange={(e) =>
              update((s) => ({
                ...s,
                research: { ...s.research, exaApiKey: e.target.value },
              }))
            }
            className={inputCls}
            autoComplete="off"
          />
        </Field>
        <Field label="Perplexity API key (optional)">
          <input
            type="password"
            value={settings.research.perplexityApiKey ?? ""}
            onChange={(e) =>
              update((s) => ({
                ...s,
                research: { ...s.research, perplexityApiKey: e.target.value },
              }))
            }
            className={inputCls}
            autoComplete="off"
          />
        </Field>
        <button onClick={() => save(settings)} className={`${btnCls} mt-4`}>
          Save
        </button>
      </Section>
    </main>
  );
}

const inputCls =
  "w-full bg-transparent border border-hairline px-3 py-2 text-sm font-mono placeholder:text-ink-faint focus:outline-none focus:border-accent/50";
const btnCls =
  "text-sm px-4 py-1.5 border border-hairline-strong text-ink-dim hover:text-ink hover:border-accent/60 disabled:opacity-40 transition-colors";

function Section({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12 border-t border-hairline pt-6">
      <h2 className="font-serif text-xl">{title}</h2>
      <p className="text-xs text-ink-faint mt-1 mb-5 max-w-lg">{sub}</p>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block mb-3">
      <span className="block text-[11px] uppercase tracking-widest text-ink-faint mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}
