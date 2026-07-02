"use client";

import { useEffect, useRef, useState } from "react";
import type { TimedScene } from "@/lib/spec/schema";

type Msg = { role: "user" | "assistant"; content: string };

export type Playhead = {
  sceneId: string;
  sceneProgress: number;
  frame: number;
} | null;

/**
 * The tutor dock. Slides over the right edge; questions carry the exact
 * playhead so the agent knows what's on screen. Tool events from the
 * server (scene insertion, seeks) are forwarded to the stage.
 */
export function ChatDock({
  open,
  lessonId,
  getPlayhead,
  onPause,
  onScenesInserted,
  onSeekToScene,
}: {
  open: boolean;
  lessonId: string;
  getPlayhead: () => Playhead;
  onPause: () => void;
  onScenesInserted: (afterSceneId: string | null, scenes: TimedScene[]) => void;
  onSeekToScene: (sceneId: string) => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!open || loadedRef.current) return;
    loadedRef.current = true;
    fetch(`/api/lesson/${lessonId}`)
      .then((r) => r.json())
      .then((d) => setMessages(d.chat ?? []))
      .catch(() => {});
  }, [open, lessonId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  const send = async () => {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);
    onPause();
    const playhead = getPlayhead();
    setMessages((m) => [...m, { role: "user", content: q }, { role: "assistant", content: "" }]);

    try {
      const res = await fetch(`/api/lesson/${lessonId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q, playhead }),
      });
      if (!res.ok || !res.body) {
        throw new Error(`chat failed: ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const raw of events) {
          const line = raw.replace(/^data: /, "").trim();
          if (!line) continue;
          const ev = JSON.parse(line);
          switch (ev.type) {
            case "text-delta":
              setMessages((m) => {
                const copy = [...m];
                copy[copy.length - 1] = {
                  role: "assistant",
                  content: copy[copy.length - 1].content + ev.text,
                };
                return copy;
              });
              break;
            case "scenes-inserted":
              onScenesInserted(ev.afterSceneId, ev.scenes);
              break;
            case "seek":
              onSeekToScene(ev.sceneId);
              break;
            case "error":
              setMessages((m) => {
                const copy = [...m];
                copy[copy.length - 1] = {
                  role: "assistant",
                  content:
                    copy[copy.length - 1].content ||
                    `⚠ ${ev.message}`,
                };
                return copy;
              });
              break;
          }
        }
      }
    } catch (e) {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role: "assistant",
          content: `⚠ ${e instanceof Error ? e.message : "chat failed"}`,
        };
        return copy;
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside
      className={`absolute top-0 right-0 bottom-0 w-[380px] max-w-full bg-bg/95 backdrop-blur border-l border-hairline flex flex-col transition-transform duration-300 z-20 ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="px-4 py-3 border-b border-hairline">
        <h2 className="font-serif text-ink-dim">Tutor</h2>
        <p className="text-[11px] text-ink-faint mt-0.5">
          Ask about anything on screen — I know where you are in the lesson.
        </p>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-ink-faint text-sm font-serif italic">
            “wait, why does that work?” · “show me an example” · “go deeper”
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i}>
            <div className="text-[10px] uppercase tracking-widest text-ink-faint mb-1">
              {m.role === "user" ? "you" : "tutor"}
            </div>
            <div
              className={`font-serif text-[15px] leading-relaxed whitespace-pre-wrap ${
                m.role === "user" ? "text-ink" : "text-ink-dim"
              }`}
            >
              {m.content || (busy && i === messages.length - 1 ? "…" : "")}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-hairline p-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          placeholder="Ask the tutor…"
          className="w-full resize-none bg-transparent border border-hairline px-3 py-2 text-sm font-serif placeholder:text-ink-faint focus:outline-none focus:border-accent/50"
        />
        <div className="flex justify-between items-center mt-2">
          <span className="text-[10px] text-ink-faint font-mono">
            pauses playback · answers can add scenes
          </span>
          <button
            onClick={send}
            disabled={busy || !input.trim()}
            className="text-xs px-3 py-1 border border-hairline-strong text-ink-dim hover:text-ink hover:border-accent/60 disabled:opacity-40 transition-colors"
          >
            {busy ? "thinking…" : "send"}
          </button>
        </div>
      </div>
    </aside>
  );
}
