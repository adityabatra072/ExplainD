import React from "react";
import { AbsoluteFill, Audio, Sequence, useCurrentFrame, interpolate } from "remotion";
import type { TimedScene } from "@/lib/spec/schema";
import { buildFrameMap } from "@/lib/timeline";
import { SceneRenderer } from "./SceneRenderer";
import { stage } from "./theme";
import { loadStageFonts } from "./fonts";

loadStageFonts();

export type LessonCompositionProps = {
  scenes: TimedScene[];
};

const TRANSITION_FRAMES = 12;

/**
 * The whole lesson as a stack of Sequences (one per scene) with per-scene
 * audio. Insertion of a scene is just a props change — offsets recompute.
 */
export const LessonComposition: React.FC<LessonCompositionProps> = ({
  scenes,
}) => {
  const map = buildFrameMap(scenes);

  return (
    <AbsoluteFill style={{ background: stage.bgVignette }}>
      {scenes.map((scene, i) => {
        const entry = map.scenes[i];
        return (
          <Sequence
            key={scene.spec.id}
            from={entry.fromFrame}
            durationInFrames={entry.durationInFrames}
            name={scene.spec.title}
          >
            <SceneTransition transitionIn={scene.spec.transitionIn}>
              <SceneRenderer scene={scene} />
            </SceneTransition>
            {scene.audioUrl && <Audio src={toAbsoluteUrl(scene.audioUrl)} />}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

/** Simple entry transition wrapper — frame-driven, works inside Sequence. */
const SceneTransition: React.FC<{
  transitionIn: string;
  children: React.ReactNode;
}> = ({ transitionIn, children }) => {
  const frame = useCurrentFrame();
  if (transitionIn === "none") return <>{children}</>;
  const p = interpolate(frame, [0, TRANSITION_FRAMES], [0, 1], {
    extrapolateRight: "clamp",
  });
  const style: React.CSSProperties =
    transitionIn === "slide"
      ? { opacity: p, transform: `translateX(${(1 - p) * 60}px)` }
      : transitionIn === "wipe"
        ? { clipPath: `inset(0 ${(1 - p) * 100}% 0 0)` }
        : { opacity: p };
  return <AbsoluteFill style={style}>{children}</AbsoluteFill>;
};

/**
 * Remotion's <Audio> needs absolute URLs when rendering server-side;
 * in the browser player relative URLs are fine.
 */
function toAbsoluteUrl(url: string): string {
  if (url.startsWith("http")) return url;
  if (typeof window !== "undefined") return new URL(url, window.location.origin).href;
  return `http://localhost:3000${url}`;
}
