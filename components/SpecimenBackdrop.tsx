"use client";

import { useMemo } from "react";
import { Player } from "@remotion/player";
import { LessonComposition } from "@/remotion/LessonComposition";
import { derivativeLesson } from "@/lib/spec/examples";
import { buildFrameMap, timeScene, FPS } from "@/lib/timeline";
import { CANVAS } from "@/remotion/theme";

/**
 * The landing backdrop: the real example lesson looping silently, dimmed.
 * Dogfooding — this is a genuine DSL spec, not a marketing animation.
 */
export function SpecimenBackdrop() {
  const scenes = useMemo(
    () => derivativeLesson.scenes.map((s) => timeScene(s, null, [])),
    []
  );
  const map = buildFrameMap(scenes);
  return (
    <div
      aria-hidden
      className="absolute inset-0 overflow-hidden opacity-[0.22] pointer-events-none"
      style={{
        maskImage:
          "radial-gradient(ellipse 90% 70% at 50% 45%, black 30%, transparent 75%)",
      }}
    >
      <Player
        component={LessonComposition}
        inputProps={{ scenes }}
        durationInFrames={map.totalDurationInFrames}
        fps={FPS}
        compositionWidth={CANVAS.width}
        compositionHeight={CANVAS.height}
        style={{ width: "100%", height: "100%" }}
        autoPlay
        loop
        controls={false}
        acknowledgeRemotionLicense
      />
    </div>
  );
}
