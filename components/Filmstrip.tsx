"use client";

import { useEffect, useState, type RefObject } from "react";
import type { PlayerRef } from "@remotion/player";
import type { TimedScene } from "@/lib/spec/schema";
import type { FrameMap } from "@/lib/timeline";

/**
 * One chip per scene under the stage. Click = seek. The active scene is
 * tracked from the player's frame; agent-inserted scenes get an amber tick.
 */
export function Filmstrip({
  scenes,
  outline,
  map,
  playerRef,
  onSeek,
}: {
  scenes: TimedScene[];
  outline: { id: string; title: string }[];
  map: FrameMap;
  playerRef: RefObject<PlayerRef | null>;
  onSeek: (sceneId: string) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => {
      const frame = playerRef.current?.getCurrentFrame();
      if (frame === undefined || frame === null) return;
      const entry = map.scenes.findLast?.((s) => frame >= s.fromFrame) ??
        map.scenes[0];
      if (entry) setActiveId(entry.sceneId);
    }, 250);
    return () => clearInterval(t);
  }, [map, playerRef]);

  const pendingCount = Math.max(0, outline.length - scenes.length);

  return (
    <div className="shrink-0 border-t border-hairline px-4 py-3 overflow-x-auto">
      <div className="flex gap-2 min-w-max">
        {scenes.map((s, i) => {
          const isActive = s.spec.id === activeId;
          const inserted = s.spec.id.startsWith("ins-");
          return (
            <button
              key={s.spec.id}
              onClick={() => onSeek(s.spec.id)}
              className={`group relative text-left px-3 py-2 border transition-colors w-44 shrink-0 ${
                isActive
                  ? "border-accent/70 bg-accent-dim"
                  : "border-hairline hover:border-hairline-strong"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] text-ink-faint">
                  {i + 1}
                </span>
                {inserted && (
                  <span
                    className="w-1.5 h-1.5 bg-accent rounded-full"
                    title="added by the tutor"
                  />
                )}
              </div>
              <div
                className={`mt-0.5 font-serif text-xs leading-snug line-clamp-2 ${
                  isActive ? "text-ink" : "text-ink-dim"
                }`}
              >
                {s.spec.title}
              </div>
            </button>
          );
        })}
        {Array.from({ length: pendingCount }).map((_, i) => (
          <div
            key={`pending-${i}`}
            className="px-3 py-2 border border-dashed border-hairline w-44 shrink-0 opacity-50"
          >
            <span className="font-mono text-[10px] text-ink-faint">
              {scenes.length + i + 1}
            </span>
            <div className="mt-0.5 font-serif text-xs text-ink-faint truncate">
              {outline[scenes.length + i]?.title ?? "…"}
              <span className="animate-pulse"> ⋯</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
