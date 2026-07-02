import React from "react";
import { AbsoluteFill } from "remotion";
import type { TimedScene } from "@/lib/spec/schema";
import type { ElementT, RegionT } from "@/lib/spec/schema";
import { useBeatStates, type TargetState } from "./effects/useBeat";
import { styleFor } from "./effects/presets";
import { CANVAS, colors, fonts, regionToRect, stage } from "./theme";
import { TitleEl } from "./elements/TitleEl";
import { TextEl } from "./elements/TextEl";
import { MathEl } from "./elements/MathEl";
import { CodeEl } from "./elements/CodeEl";
import { PlotEl } from "./elements/PlotEl";
import { ShapeEl } from "./elements/ShapeEl";
import { DiagramEl } from "./elements/DiagramEl";
import { TableEl } from "./elements/TableEl";
import { NumberLineEl } from "./elements/NumberLineEl";
import { ImageEl } from "./elements/ImageEl";

/**
 * Auto-layout for elements without an explicit region, per scene layout mode.
 * Deterministic: same spec always yields the same placement.
 */
function autoRegion(
  layout: string,
  index: number,
  total: number
): RegionT {
  switch (layout) {
    case "split-lr": {
      // Big visual left, stack of text right; odd elements go right.
      if (index === 0) return { col: 0, row: 0, colSpan: 7, rowSpan: 8 };
      const rightCount = total - 1;
      const span = Math.max(1, Math.floor(8 / Math.max(1, rightCount)));
      return { col: 7, row: (index - 1) * span, colSpan: 5, rowSpan: span };
    }
    case "split-tb": {
      if (index === 0) return { col: 0, row: 0, colSpan: 12, rowSpan: 5 };
      const count = total - 1;
      const span = Math.max(2, Math.floor(12 / Math.max(1, count)));
      return { col: (index - 1) * span, row: 5, colSpan: span, rowSpan: 3 };
    }
    case "full-canvas":
      return { col: 0, row: 0, colSpan: 12, rowSpan: 8 };
    case "grid": {
      const cols = total <= 4 ? 2 : 3;
      const rows = Math.ceil(total / cols);
      const cSpan = Math.floor(12 / cols);
      const rSpan = Math.floor(8 / rows);
      return {
        col: (index % cols) * cSpan,
        row: Math.floor(index / cols) * rSpan,
        colSpan: cSpan,
        rowSpan: rSpan,
      };
    }
    case "center":
    default: {
      // Vertical stack, centered.
      const span = Math.max(1, Math.floor(8 / total));
      const usedRows = span * total;
      const startRow = Math.floor((8 - usedRows) / 2);
      return { col: 1, row: startRow + index * span, colSpan: 10, rowSpan: span };
    }
  }
}

function elementNode(
  el: ElementT,
  states: Map<string, TargetState>,
  rect: { width: number; height: number }
): React.ReactNode {
  switch (el.type) {
    case "title":
      return <TitleEl el={el} />;
    case "text":
      return <TextEl el={el} />;
    case "math":
      return <MathEl el={el} states={states} />;
    case "code":
      return <CodeEl el={el} states={states} />;
    case "plot":
      return <PlotEl el={el} states={states} width={rect.width} height={rect.height} />;
    case "shape":
      return <ShapeEl el={el} state={states.get(el.id)} width={rect.width} height={rect.height} />;
    case "diagram":
      return <DiagramEl el={el} state={states.get(el.id)} width={rect.width} height={rect.height} />;
    case "table":
      return <TableEl el={el} state={states.get(el.id)} />;
    case "numberline":
      return <NumberLineEl el={el} states={states} width={rect.width} height={rect.height} />;
    case "image":
      return <ImageEl el={el} />;
    case "arrow":
      return null; // drawn in the overlay SVG below
  }
}

export const SceneRenderer: React.FC<{ scene: TimedScene }> = ({ scene }) => {
  const states = useBeatStates(scene);
  const { spec } = scene;

  // Compute rects for all non-arrow elements (arrows need endpoints' rects).
  const placeable = spec.elements.filter((e) => e.type !== "arrow");
  const rects = new Map<string, ReturnType<typeof regionToRect>>();
  placeable.forEach((el, i) => {
    const region = el.region ?? autoRegion(spec.layout, i, placeable.length);
    rects.set(el.id, regionToRect(region));
  });

  const arrows = spec.elements.filter((e) => e.type === "arrow");

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at center, ${stage.bg} 0%, ${stage.bgVignette} 100%)`,
      }}
    >
      {placeable.map((el) => {
        const rect = rects.get(el.id)!;
        const st = states.get(el.id);
        return (
          <div
            key={el.id}
            style={{
              position: "absolute",
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
              ...(st ? styleFor(st) : {}),
            }}
          >
            {elementNode(el, states, rect)}
          </div>
        );
      })}
      {arrows.length > 0 && (
        <svg
          width={CANVAS.width}
          height={CANVAS.height}
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        >
          <defs>
            <marker id="scene-arrowhead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
            </marker>
          </defs>
          {arrows.map((ar) => {
            if (ar.type !== "arrow") return null;
            const a = rects.get(ar.from);
            const b = rects.get(ar.to);
            if (!a || !b) return null;
            const st = states.get(ar.id);
            const vis = st ? st.visibility * (st.dimmed ? 0.25 : 1) : 1;
            const [x1, y1] = edgePoint(a, b);
            const [x2, y2] = edgePoint(b, a);
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;
            return (
              <g key={ar.id} opacity={vis} color={colors[ar.color]}>
                <line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke="currentColor"
                  strokeWidth={3.5}
                  strokeDasharray={ar.style === "dashed" ? "10 8" : undefined}
                  markerEnd="url(#scene-arrowhead)"
                />
                {ar.label && (
                  <text x={midX} y={midY - 14} textAnchor="middle" fill={stage.inkDim} fontSize={24} fontFamily={fonts.ui}>
                    {ar.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </AbsoluteFill>
  );
};

/** Point on rect A's boundary along the line toward rect B's center. */
function edgePoint(
  a: { left: number; top: number; width: number; height: number },
  b: { left: number; top: number; width: number; height: number }
): [number, number] {
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  const bx = b.left + b.width / 2;
  const by = b.top + b.height / 2;
  const dx = bx - ax;
  const dy = by - ay;
  const scaleX = dx !== 0 ? a.width / 2 / Math.abs(dx) : Infinity;
  const scaleY = dy !== 0 ? a.height / 2 / Math.abs(dy) : Infinity;
  const s = Math.min(scaleX, scaleY, 1) * 0.92;
  return [ax + dx * s, ay + dy * s];
}
