"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Player } from "@remotion/player";
import { LessonComposition } from "@/remotion/LessonComposition";
import { derivativeLesson } from "@/lib/spec/examples";
import { buildFrameMap, timeScene, FPS } from "@/lib/timeline";
import { CANVAS } from "@/remotion/theme";
import type { TimedScene } from "@/lib/spec/schema";

/**
 * Dev harness for the renderer.
 *   /dev/stage            — silent, estimated timings
 *   /dev/stage?audio=1    — real Edge TTS audio + word-exact beat sync
 *   /dev/stage?frame=N    — paused at frame N (deterministic QA screenshots)
 */
export default function StageDevPage() {
  return (
    <Suspense>
      <StageDevInner />
    </Suspense>
  );
}

function StageDevInner() {
  const params = useSearchParams();
  const frameParam = params.get("frame");
  const withAudio = params.get("audio") === "1";
  const initialFrame = frameParam ? parseInt(frameParam, 10) : null;

  const silentScenes = useMemo(
    () => derivativeLesson.scenes.map((s) => timeScene(s, null, [])),
    []
  );
  const [scenes, setScenes] = useState<TimedScene[]>(silentScenes);
  const [audioState, setAudioState] = useState<string>(
    withAudio ? "synthesizing narration…" : ""
  );

  useEffect(() => {
    if (!withAudio) return;
    fetch("/api/dev/example-lesson")
      .then((r) => r.json())
      .then((data) => {
        setScenes(data.scenes);
        setAudioState("voiced (Edge TTS, word-level sync)");
      })
      .catch((e) => setAudioState(`TTS failed: ${e}`));
  }, [withAudio]);

  const map = buildFrameMap(scenes);

  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="font-serif text-2xl text-ink-dim">
        Renderer harness — {derivativeLesson.title}
      </h1>
      <div className="w-full max-w-6xl border border-hairline">
        <Player
          key={scenes === silentScenes ? "silent" : "voiced"}
          component={LessonComposition}
          inputProps={{ scenes }}
          durationInFrames={map.totalDurationInFrames}
          fps={FPS}
          compositionWidth={CANVAS.width}
          compositionHeight={CANVAS.height}
          style={{ width: "100%" }}
          controls
          loop={initialFrame === null}
          autoPlay={false}
          initialFrame={initialFrame ?? 0}
          acknowledgeRemotionLicense
        />
      </div>
      <p className="text-ink-faint text-sm font-mono">
        {scenes.length} scenes · {map.totalDurationInFrames} frames ·{" "}
        {Math.round(map.totalDurationInFrames / FPS)}s
        {audioState ? ` · ${audioState}` : " · silent (estimated timings)"}
      </p>
    </main>
  );
}
