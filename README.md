<div align="center">

# ExplainD

**Anything, explained in motion.**

An interactive education engine: paste a concept, lecture notes, or a rambling
question — get an animated, narrated lesson you can *talk to* while it plays.

</div>

---

## What it does

- **Paste anything → animated lesson.** A model designs a visual-first outline,
  writes each scene as a structured animation spec (plots, math that reveals
  part-by-part, code walkthroughs, auto-laid-out diagrams, tables, number
  lines), and narrates it with a neural voice. Playback starts as soon as the
  first scene is ready.
- **Word-exact sync.** Narration is synthesized with per-word timestamps;
  every animation beat is anchored to the word being spoken, so visuals land
  precisely on the voiceover at any speaking rate.
- **Interrupt and ask.** Pause anywhere and ask the tutor a question. It knows
  the exact moment you're at — which scene, which words you just heard, what's
  visible on screen — and it answers in chat, **inserts new animated scenes**
  right after the current one, or jumps you back to the scene that already
  covered it.
- **Voice mode.** Hold <kbd>Space</kbd> and talk (Chrome/Edge). Replies are
  spoken back; visual answers play as new scenes.
- **Completely model-agnostic.** Anthropic, OpenAI, Google Gemini, Amazon
  Bedrock, OpenRouter, Ollama (fully local), or any LiteLLM proxy — pick a
  provider, paste a key, go.
- **Research when it matters.** Topical lessons are grounded with Exa or
  Perplexity if you add a key; Wikipedia and DuckDuckGo work free with no key.
- **Export to MP4.** Any lesson renders to a shareable video file.

## Why LLM → spec, not LLM → code

Earlier versions of this project asked a model to write Manim code, which
failed constantly. v2 has the model emit a **JSON scene spec** — elements,
grid regions, and animation "beats" anchored to narration words — validated by
zod with an automatic repair loop, and rendered by a library of prebuilt
[Remotion](https://remotion.dev) components. Structured output is easy for
models to get right, and every failure is machine-checkable and repairable.

## Quick start

```bash
git clone https://github.com/adityabatra072/ExplainD.git
cd ExplainD
npm install
npm run dev
```

Open http://localhost:3000, then pick a model in **Settings**:

| Provider | Needs | Notes |
| --- | --- | --- |
| Anthropic | API key | `claude-sonnet-4-5` recommended |
| OpenAI | API key | |
| Google Gemini | API key | |
| Amazon Bedrock | `aws configure` | no key stored; uses your AWS credential chain |
| OpenRouter | API key | any model on their catalog |
| Ollama | local server | fully offline generation |
| LiteLLM | proxy URL (+key) | 100+ providers behind one endpoint |

Voiceover defaults to free Microsoft Edge neural voices (no key needed).
OpenAI TTS and ElevenLabs are optional upgrades in Settings.

**Requirements:** Node 20+. For MP4 export, Remotion downloads a headless
browser on first render. TTS requires internet (or swap in a local engine —
see `lib/tts/`).

## Privacy & keys

API keys are stored in a local SQLite database (`.data/`, gitignored) on your
machine and sent only to the provider you configured. The settings API returns
keys masked; masked values echoed back can never overwrite stored secrets.
Nothing is telemetered anywhere.

Voice mode uses the browser's Web Speech API, which processes audio through
your browser vendor's speech service (Chrome → Google). Unsupported browsers
fall back to text chat.

## Architecture

```
prompt ─→ research? ─→ outline ─→ per-scene spec (zod validate → repair → salvage)
                                        │
                                        ├─→ Edge TTS → mp3 + word timestamps
                                        ▼
                          TimedScene { spec, audio, resolvedBeats }
                                        │
                     ┌──────────────────┴──────────────────┐
                     ▼                                     ▼
          @remotion/player (live, interactive)   @remotion/renderer (MP4)
                     ▲
        tutor agent: playhead-aware context
        tools: insert_scenes · seek_to_scene · do_research
```

- `lib/spec/schema.ts` — the scene-spec DSL (the heart of the system)
- `lib/pipeline/` — outline/scene generation, prompts, SSE orchestration
- `lib/agent/` — the interactive tutor (context builder, tools, memory)
- `lib/tts/` — Edge / OpenAI / ElevenLabs adapters behind one interface
- `lib/llm/registry.ts` — one function: provider + model + key → LanguageModel
- `remotion/` — element renderers and the beat engine (shared by player & export)

## Development

```bash
npm run dev          # app
npm run studio       # Remotion Studio for element development
npm run typecheck    # tsc
npm run e2e          # Playwright (SKIP_LLM_TESTS=1 to skip generation tests)
npx tsx scripts/verify-tts.ts    # check Edge TTS + word boundaries
npx tsx scripts/qa-pipeline.ts   # generate 5 lessons, report spec quality
```

## License notes

This project uses [Remotion](https://remotion.dev), which is free for
individuals and companies of up to three people; larger companies need a
[Remotion company license](https://remotion.dev/license). The ExplainD source
itself is MIT.
