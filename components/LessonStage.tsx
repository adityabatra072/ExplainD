"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { Player, type PlayerRef } from "@remotion/player";
import { LessonComposition } from "@/remotion/LessonComposition";
import { buildFrameMap, locateFrame, FPS } from "@/lib/timeline";
import { CANVAS } from "@/remotion/theme";
import type { TimedScene } from "@/lib/spec/schema";
import { Filmstrip } from "./Filmstrip";
import { ChatDock } from "./ChatDock";

type LessonMeta = {
  id: string;
  title: string;
  status: "generating" | "ready" | "error";
  error: string | null;
};

type OutlineItem = { id: string; title: string };

export function LessonStage({ lessonId }: { lessonId: string }) {
  const playerRef = useRef<PlayerRef>(null);
  const [lesson, setLesson] = useState<LessonMeta | null>(null);
  const [scenes, setScenes] = useState<TimedScene[]>([]);
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [statusLine, setStatusLine] = useState("Loading…");
  const [error, setError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const startedPlayback = useRef(false);

  const map = useMemo(() => buildFrameMap(scenes), [scenes]);

  /** Insert scenes after a given scene id (agent tool result). */
  const spliceScenes = useCallback(
    (afterSceneId: string | null, newScenes: TimedScene[]) => {
      setScenes((prev) => {
        if (!afterSceneId) return [...prev, ...newScenes];
        const idx = prev.findIndex((s) => s.spec.id === afterSceneId);
        if (idx < 0) return [...prev, ...newScenes];
        return [...prev.slice(0, idx + 1), ...newScenes, ...prev.slice(idx + 1)];
      });
    },
    []
  );

  const seekToScene = useCallback(
    (sceneId: string) => {
      const entry = map.scenes.find((s) => s.sceneId === sceneId);
      if (entry && playerRef.current) {
        playerRef.current.seekTo(entry.fromFrame);
        playerRef.current.play();
      }
    },
    [map]
  );

  /** Current playhead for the agent: scene + progress at this instant. */
  const getPlayhead = useCallback(() => {
    const frame = playerRef.current?.getCurrentFrame() ?? 0;
    const loc = locateFrame(map, frame);
    return loc
      ? { sceneId: loc.sceneId, sceneProgress: loc.sceneProgress, frame }
      : null;
  }, [map]);

  // Load lesson; if still generating, attach to the SSE stream.
  useEffect(() => {
    let stop = false;
    let es: EventSource | null = null;

    (async () => {
      const res = await fetch(`/api/lesson/${lessonId}`);
      if (!res.ok) {
        setError("Lesson not found.");
        return;
      }
      const data = await res.json();
      if (stop) return;
      setLesson(data.lesson);
      setScenes(data.scenes);
      if (data.lesson.outline) {
        setOutline(data.lesson.outline.scenes);
      }

      if (data.lesson.status === "generating") {
        setStatusLine("Starting generation…");
        es = new EventSource(`/api/lesson/${lessonId}/stream`);
        es.onmessage = (ev) => {
          const event = JSON.parse(ev.data);
          switch (event.type) {
            case "status":
              setStatusLine(event.message);
              break;
            case "outline":
              setOutline(event.outline.scenes);
              setLesson((l) => (l ? { ...l, title: event.title } : l));
              break;
            case "scene":
              setScenes((prev) => [...prev, event.scene]);
              break;
            case "done":
              setStatusLine("");
              setLesson((l) => (l ? { ...l, status: "ready" } : l));
              es?.close();
              break;
            case "error":
              setError(event.message);
              setStatusLine("");
              es?.close();
              break;
          }
        };
        es.onerror = () => {
          // Server closed the stream (done) or network hiccup; re-sync state.
          es?.close();
          fetch(`/api/lesson/${lessonId}`)
            .then((r) => r.json())
            .then((d) => {
              setLesson(d.lesson);
              setScenes(d.scenes);
              if (d.lesson.status !== "generating") setStatusLine("");
              if (d.lesson.error) setError(d.lesson.error);
            })
            .catch(() => {});
        };
      } else {
        setStatusLine("");
        if (data.lesson.error) setError(data.lesson.error);
      }
    })();

    return () => {
      stop = true;
      es?.close();
    };
  }, [lessonId]);

  // Autoplay once the first scene lands.
  useEffect(() => {
    if (scenes.length > 0 && !startedPlayback.current) {
      startedPlayback.current = true;
      setTimeout(() => playerRef.current?.play(), 300);
    }
  }, [scenes.length]);

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-hairline shrink-0">
        <div className="flex items-baseline gap-4 min-w-0">
          <Link
            href="/"
            className="font-serif text-lg text-ink-dim hover:text-ink transition-colors shrink-0"
          >
            Explain<span className="text-accent">D</span>
          </Link>
          <h1 className="font-serif text-ink truncate">
            {lesson?.title || "…"}
          </h1>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {statusLine && (
            <span className="text-xs text-accent/80 font-mono animate-pulse">
              {statusLine}
            </span>
          )}
          <button
            onClick={() => setChatOpen((o) => !o)}
            className={`text-sm px-3 py-1 border transition-colors ${
              chatOpen
                ? "border-accent/60 text-accent"
                : "border-hairline-strong text-ink-dim hover:text-ink"
            }`}
          >
            Ask the tutor
          </button>
        </div>
      </header>

      {/* Stage */}
      <div className="relative flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 flex items-center justify-center p-4">
          {error ? (
            <div className="max-w-lg text-center">
              <p className="font-serif text-xl text-ink">Something broke.</p>
              <p className="mt-2 text-sm text-ink-dim font-mono">{error}</p>
              <Link
                href="/"
                className="mt-6 inline-block text-sm border border-hairline-strong px-4 py-1.5 text-ink-dim hover:text-ink"
              >
                ← start over
              </Link>
            </div>
          ) : scenes.length === 0 ? (
            <GeneratingPlaceholder statusLine={statusLine} outline={outline} />
          ) : (
            <div className="w-full max-w-[1200px] border border-hairline">
              <Player
                ref={playerRef}
                component={LessonComposition}
                inputProps={{ scenes }}
                durationInFrames={map.totalDurationInFrames}
                fps={FPS}
                compositionWidth={CANVAS.width}
                compositionHeight={CANVAS.height}
                style={{ width: "100%" }}
                controls
                acknowledgeRemotionLicense
              />
            </div>
          )}
        </div>

        {/* Filmstrip */}
        {scenes.length > 0 && (
          <Filmstrip
            scenes={scenes}
            outline={outline}
            map={map}
            playerRef={playerRef}
            onSeek={seekToScene}
          />
        )}

        {/* Chat dock */}
        <ChatDock
          open={chatOpen}
          lessonId={lessonId}
          getPlayhead={getPlayhead}
          onPause={() => playerRef.current?.pause()}
          onScenesInserted={spliceScenes}
          onSeekToScene={seekToScene}
        />
      </div>
    </div>
  );
}

function GeneratingPlaceholder({
  statusLine,
  outline,
}: {
  statusLine: string;
  outline: OutlineItem[];
}) {
  return (
    <div className="text-center max-w-md">
      <div className="font-serif italic text-2xl text-ink-dim">
        {statusLine || "Thinking about how to show this…"}
      </div>
      {outline.length > 0 && (
        <ol className="mt-8 text-left space-y-2">
          {outline.map((s, i) => (
            <li key={s.id} className="text-ink-faint text-sm font-serif">
              <span className="text-accent/60 font-mono text-xs mr-2">
                {i + 1}
              </span>
              {s.title}
            </li>
          ))}
        </ol>
      )}
      <p className="mt-8 text-xs text-ink-faint font-mono">
        playback begins as soon as the first scene is voiced
      </p>
    </div>
  );
}
