import { z } from "zod";

/**
 * The ExplainD Scene Spec DSL.
 *
 * The LLM emits this JSON — never render code. Design constraints:
 * - Flat and enum-heavy: easy for models to produce, easy to validate.
 * - 12x8 grid positioning instead of pixels (models are bad at pixels).
 * - Beats anchor to narration progress (fraction 0..1) or a literal word
 *   (`atWord`), never to wall-clock time. Word timestamps from TTS resolve
 *   beats to frames at playback, so sync is exact for any voice speed.
 */

export const ColorToken = z.enum([
  "accent", // amber — the "look here" color
  "secondary", // cyan — contrast/comparison
  "positive",
  "negative",
  "muted",
  "ink", // default foreground
]);
export type ColorTokenT = z.infer<typeof ColorToken>;

export const Region = z.object({
  col: z.number().int().min(0).max(11),
  row: z.number().int().min(0).max(7),
  colSpan: z.number().int().min(1).max(12).default(4),
  rowSpan: z.number().int().min(1).max(8).default(2),
});
export type RegionT = z.infer<typeof Region>;

const elementBase = {
  id: z.string().min(1),
  region: Region.optional(),
};

export const TitleElement = z.object({
  ...elementBase,
  type: z.literal("title"),
  text: z.string(),
  size: z.enum(["hero", "lg", "md"]).default("lg"),
});

export const TextElement = z.object({
  ...elementBase,
  type: z.literal("text"),
  /** Supports **bold**, *italic* and $inline latex$. */
  text: z.string(),
  align: z.enum(["left", "center"]).default("left"),
  size: z.enum(["lg", "md", "sm"]).default("md"),
  color: ColorToken.default("ink"),
});

export const MathElement = z.object({
  ...elementBase,
  type: z.literal("math"),
  /** Display-mode KaTeX. If `parts` given, latex is built from parts joined in order. */
  latex: z.string(),
  /** Optional split for part-by-part reveal via `reveal-part` beats targeting "elId.partId". */
  parts: z
    .array(z.object({ id: z.string(), latex: z.string() }))
    .optional(),
  size: z.enum(["lg", "md", "sm"]).default("md"),
});

export const CodeElement = z.object({
  ...elementBase,
  type: z.literal("code"),
  language: z.string().default("text"),
  code: z.string(),
  /** Line ranges (1-indexed, inclusive) addressable by `highlight` beats as "elId.hlId". */
  highlights: z
    .array(
      z.object({
        id: z.string(),
        lines: z.tuple([z.number().int().min(1), z.number().int().min(1)]),
      })
    )
    .optional(),
});

export const PlotElement = z.object({
  ...elementBase,
  type: z.literal("plot"),
  /** mathjs expressions in x, e.g. "x^2/4", "sin(x)". Addressable as "elId.fnId" for draw beats. */
  fns: z
    .array(
      z.object({
        id: z.string(),
        expr: z.string(),
        color: ColorToken.default("accent"),
        label: z.string().optional(),
      })
    )
    .default([]),
  xDomain: z.tuple([z.number(), z.number()]).default([-5, 5]),
  yDomain: z.tuple([z.number(), z.number()]).optional(),
  points: z
    .array(
      z.object({
        id: z.string(),
        x: z.number(),
        y: z.number(),
        label: z.string().optional(),
        color: ColorToken.default("secondary"),
      })
    )
    .optional(),
  /** Vertical/horizontal reference lines, addressable for enter beats. */
  lines: z
    .array(
      z.object({
        id: z.string(),
        axis: z.enum(["x", "y"]),
        at: z.number(),
        label: z.string().optional(),
      })
    )
    .optional(),
  showGrid: z.boolean().default(true),
  showAxes: z.boolean().default(true),
});

export const ShapeElement = z.object({
  ...elementBase,
  type: z.literal("shape"),
  shape: z.enum(["circle", "rect", "triangle", "ellipse", "line", "polygon"]),
  label: z.string().optional(),
  fill: ColorToken.optional(),
  stroke: ColorToken.default("ink"),
  /** For polygon/line: vertices in local 0..100 coordinates. */
  points: z.array(z.tuple([z.number(), z.number()])).optional(),
});

export const ArrowElement = z.object({
  ...elementBase,
  type: z.literal("arrow"),
  /** IDs of other elements in the same scene. */
  from: z.string(),
  to: z.string(),
  label: z.string().optional(),
  style: z.enum(["solid", "dashed"]).default("solid"),
  color: ColorToken.default("muted"),
});

export const DiagramElement = z.object({
  ...elementBase,
  type: z.literal("diagram"),
  nodes: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        kind: z.enum(["box", "pill", "diamond"]).default("box"),
        color: ColorToken.default("ink"),
      })
    )
    .min(1),
  edges: z
    .array(
      z.object({
        from: z.string(),
        to: z.string(),
        label: z.string().optional(),
      })
    )
    .default([]),
  direction: z.enum(["TB", "LR"]).default("TB"),
});

export const TableElement = z.object({
  ...elementBase,
  type: z.literal("table"),
  headers: z.array(z.string()).min(1),
  rows: z.array(z.array(z.string())).min(1),
});

export const NumberLineElement = z.object({
  ...elementBase,
  type: z.literal("numberline"),
  min: z.number(),
  max: z.number(),
  /** Marks addressable as "elId.markId" for enter/emphasize beats. */
  marks: z
    .array(
      z.object({
        id: z.string(),
        at: z.number(),
        label: z.string().optional(),
        color: ColorToken.default("accent"),
      })
    )
    .default([]),
});

export const ImageElement = z.object({
  ...elementBase,
  type: z.literal("image"),
  /** v1 renders a styled placeholder card with the alt text. */
  query: z.string(),
  alt: z.string(),
});

export const Element = z.discriminatedUnion("type", [
  TitleElement,
  TextElement,
  MathElement,
  CodeElement,
  PlotElement,
  ShapeElement,
  ArrowElement,
  DiagramElement,
  TableElement,
  NumberLineElement,
  ImageElement,
]);
export type ElementT = z.infer<typeof Element>;

export const BeatAction = z.enum([
  "enter",
  "exit",
  "emphasize",
  "highlight",
  "draw",
  "reveal-part",
  "dim-others",
  "undim",
]);

export const BeatEffect = z.enum([
  "fade",
  "slide-up",
  "slide-left",
  "scale",
  "draw-in",
  "typewriter",
  "none",
]);

export const Beat = z.object({
  /**
   * When to fire, as a fraction of narration words spoken (0..1).
   * If `atWord` is set it wins: resolved to the first occurrence of that
   * word in the narration at validation time.
   */
  at: z.number().min(0).max(1).default(0),
  atWord: z.string().optional(),
  /** "elementId" or "elementId.subId" (math part, code highlight, plot fn/point/line, numberline mark). */
  target: z.string().min(1),
  action: BeatAction,
  effect: BeatEffect.default("fade"),
  durationMs: z.number().min(100).max(5000).default(600),
});
export type BeatT = z.infer<typeof Beat>;

export const SceneSpec = z.object({
  id: z.string().min(1),
  title: z.string(),
  /** The exact voiceover script: plain conversational prose, no markup. */
  narration: z.string().min(1),
  layout: z
    .enum(["center", "split-lr", "split-tb", "full-canvas", "grid"])
    .default("center"),
  elements: z.array(Element).max(10),
  beats: z.array(Beat).default([]),
  transitionIn: z.enum(["fade", "slide", "wipe", "none"]).default("fade"),
});
export type SceneSpecT = z.infer<typeof SceneSpec>;

export const LessonSpec = z.object({
  version: z.literal(1).default(1),
  title: z.string(),
  audience: z.string().default("general"),
  scenes: z.array(SceneSpec).min(1),
});
export type LessonSpecT = z.infer<typeof LessonSpec>;

/** Per-word timing from TTS (ms from audio start). */
export type WordTiming = { word: string; offsetMs: number; durationMs: number };

/** A scene ready for playback: spec + audio + resolved timing. */
export type TimedScene = {
  spec: SceneSpecT;
  audioUrl: string | null;
  wordTimings: WordTiming[];
  /** Total scene duration in ms (audio end + tail padding). */
  durationMs: number;
  /** Beats with `at`/`atWord` resolved to absolute ms within the scene. */
  resolvedBeats: (BeatT & { atMs: number })[];
};
