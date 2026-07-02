import type { CSSProperties } from "react";
import type { TargetState } from "./useBeat";

/**
 * Convert a target's beat state into container CSS (transform/opacity only —
 * cheap for the compositor, deterministic per frame).
 */
export function styleFor(state: TargetState): CSSProperties {
  const { visibility, enterProgress, effect, emphasis, dimmed } = state;
  const ease = easeOutCubic(enterProgress);

  let transform = "";
  switch (effect) {
    case "slide-up":
      transform += ` translateY(${(1 - ease) * 48}px)`;
      break;
    case "slide-left":
      transform += ` translateX(${(1 - ease) * 64}px)`;
      break;
    case "scale":
      transform += ` scale(${0.72 + ease * 0.28})`;
      break;
  }
  if (emphasis > 0) {
    transform += ` scale(${1 + emphasis * 0.06})`;
  }

  return {
    opacity: visibility * (dimmed ? 0.22 : 1),
    transform: transform || undefined,
    filter:
      emphasis > 0
        ? `drop-shadow(0 0 ${emphasis * 22}px rgba(245,166,35,0.45))`
        : undefined,
  };
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Typewriter: how many characters of `text` are visible at this progress. */
export function typewriterCount(text: string, progress: number): number {
  return Math.round(easeOutCubic(progress) * text.length);
}
