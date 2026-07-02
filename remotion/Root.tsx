import React from "react";
import { Composition } from "remotion";
import { LessonComposition } from "./LessonComposition";
import { derivativeLesson } from "@/lib/spec/examples";
import { timeScene, buildFrameMap, FPS } from "@/lib/timeline";
import { CANVAS } from "./theme";

/**
 * Remotion Studio / renderer entry. The real app drives LessonComposition
 * through @remotion/player with live props; this registration exists for
 * `npm run studio` (element development) and MP4 export.
 */
const defaultScenes = derivativeLesson.scenes.map((s) => timeScene(s, null, []));

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Lesson"
      component={LessonComposition}
      durationInFrames={buildFrameMap(defaultScenes).totalDurationInFrames}
      fps={FPS}
      width={CANVAS.width}
      height={CANVAS.height}
      defaultProps={{ scenes: defaultScenes }}
      calculateMetadata={({ props }) => ({
        durationInFrames: buildFrameMap(props.scenes).totalDurationInFrames,
      })}
    />
  );
};
