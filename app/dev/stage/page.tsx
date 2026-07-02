"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Player } from "@remotion/player";
import { LessonComposition } from "@/remotion/LessonComposition";
import { derivativeLesson } from "@/lib/spec/examples";
import { buildFrameMap, timeScene, FPS } from "@/lib/timeline";
import { CANVAS } from "@/remotion/theme";

/**
 * Dev harness: renders the hand-written example lesson (no audio yet).
 * Kept in production builds — it's a useful renderer smoke test page.
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
  // ?frame=N pauses at an exact frame — used by QA screenshots.
  const frameParam = params.get("frame");
  const initialFrame = frameParam ? parseInt(frameParam, 10) : null;
  const scenes = useMemo(
    () => derivativeLesson.scenes.map((s) => timeScene(s, null, [])),
    []
  );
  const map = buildFrameMap(scenes);

  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="font-serif text-2xl text-ink-dim">
        Renderer harness — {derivativeLesson.title}
      </h1>
      <div className="w-full max-w-6xl border border-hairline">
        <Player
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
        {Math.round(map.totalDurationInFrames / FPS)}s (silent — word timings
        estimated)
      </p>
    </main>
  );
}
