import type { ColorTokenT } from "@/lib/spec/schema";

/** Canvas design tokens — the stage is the only colorful thing in the app. */
export const stage = {
  bg: "#11141F",
  bgVignette: "#0B0D14",
  grid: "rgba(255,255,255,0.05)",
  axis: "rgba(255,255,255,0.28)",
  ink: "#E8E6E1",
  inkDim: "rgba(232,230,225,0.55)",
  hairline: "rgba(255,255,255,0.08)",
} as const;

export const colors: Record<ColorTokenT, string> = {
  accent: "#F5A623",
  secondary: "#4EC9B0",
  positive: "#7BC96F",
  negative: "#E5684F",
  muted: "rgba(232,230,225,0.55)",
  ink: stage.ink,
};

export const fonts = {
  serif: `"Spectral", Georgia, serif`,
  ui: `"Inter Tight", "Segoe UI", sans-serif`,
  mono: `"JetBrains Mono", Consolas, monospace`,
} as const;

export const CANVAS = { width: 1920, height: 1080 } as const;

/** 12x8 grid with outer margins; converts a Region to pixel rect. */
export const GRID = {
  cols: 12,
  rows: 8,
  marginX: 96,
  marginY: 72,
} as const;

export function regionToRect(region: {
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
}) {
  const innerW = CANVAS.width - GRID.marginX * 2;
  const innerH = CANVAS.height - GRID.marginY * 2;
  const cw = innerW / GRID.cols;
  const ch = innerH / GRID.rows;
  return {
    left: GRID.marginX + region.col * cw,
    top: GRID.marginY + region.row * ch,
    width: region.colSpan * cw,
    height: region.rowSpan * ch,
  };
}
