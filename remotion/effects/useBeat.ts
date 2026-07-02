import { interpolate, useCurrentFrame } from "remotion";
import type { TimedScene } from "@/lib/spec/schema";
import { FPS } from "@/lib/timeline";

export type TargetState = {
  /** 0 before enter starts, 1 when fully entered; falls back to 0 after exit. */
  visibility: number;
  /** Progress of the most recent enter/draw effect (0..1), for draw-in etc. */
  enterProgress: number;
  effect: string;
  /** 1 while an emphasize beat is active (decays over its duration). */
  emphasis: number;
  /** 1 when this target is dimmed by an active dim-others. */
  dimmed: number;
  /** 0..1 progress of highlight action on this target. */
  highlight: number;
};

const IDLE: TargetState = {
  visibility: 0,
  enterProgress: 0,
  effect: "fade",
  emphasis: 0,
  dimmed: 0,
  highlight: 0,
};

/**
 * Resolve the animation state of every beat target at the current frame.
 * Pure frame math over resolvedBeats — no CSS animations (Remotion rule).
 *
 * Elements that never receive an `enter`/`draw`/`reveal-part` beat are
 * visible from frame 0 (so sparse specs from weak models still render).
 */
export function useBeatStates(scene: TimedScene): Map<string, TargetState> {
  const frame = useCurrentFrame();
  return computeBeatStates(scene, frame);
}

export function computeBeatStates(
  scene: TimedScene,
  frame: number
): Map<string, TargetState> {
  const nowMs = (frame / FPS) * 1000;
  const states = new Map<string, TargetState>();

  const enterActions = new Set(["enter", "draw", "reveal-part"]);
  const entersByTarget = new Set(
    scene.resolvedBeats.filter((b) => enterActions.has(b.action)).map((b) => b.target)
  );

  // Seed: every element (and sub-target) starts visible unless it has an
  // explicit enter-type beat, in which case it starts hidden.
  const seed = (target: string) => {
    if (!states.has(target)) {
      states.set(target, {
        ...IDLE,
        visibility: entersByTarget.has(target) ? 0 : 1,
        enterProgress: entersByTarget.has(target) ? 0 : 1,
      });
    }
    return states.get(target)!;
  };

  for (const el of scene.spec.elements) seed(el.id);
  for (const b of scene.resolvedBeats) seed(b.target);

  // dim-others handling: find the latest dim window that contains nowMs.
  let dimActiveFor: string | null = null;
  for (const b of scene.resolvedBeats) {
    if (b.action === "dim-others" && nowMs >= b.atMs) dimActiveFor = b.target;
    if (b.action === "undim" && nowMs >= b.atMs) dimActiveFor = null;
  }

  for (const b of scene.resolvedBeats) {
    if (nowMs < b.atMs) continue;
    const t = seed(b.target);
    const durMs = Math.max(1, b.durationMs);
    const progress = Math.min(1, (nowMs - b.atMs) / durMs);

    switch (b.action) {
      case "enter":
      case "draw":
      case "reveal-part":
        t.visibility = progress;
        t.enterProgress = progress;
        t.effect = b.effect;
        break;
      case "exit":
        t.visibility = 1 - progress;
        break;
      case "emphasize":
        // Pulse: rises fast, decays across the beat duration.
        t.emphasis = interpolate(progress, [0, 0.2, 1], [0, 1, 0]);
        break;
      case "highlight":
        t.highlight = progress;
        break;
      // dim-others/undim handled below
    }
  }

  if (dimActiveFor) {
    for (const [target, st] of states) {
      const isFocus =
        target === dimActiveFor || target.startsWith(dimActiveFor + ".");
      if (!isFocus) st.dimmed = 1;
    }
  }

  return states;
}
