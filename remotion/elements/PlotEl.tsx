import React, { useMemo } from "react";
import { compile } from "mathjs";
import type { z } from "zod";
import type { PlotElement } from "@/lib/spec/schema";
import type { TargetState } from "../effects/useBeat";
import { colors, fonts, stage } from "../theme";
import { easeOutCubic } from "../effects/presets";

const SAMPLES = 240;

type Fn = z.infer<typeof PlotElement>["fns"][number];

function samplePath(
  fn: Fn,
  xDomain: [number, number],
  yDomain: [number, number],
  w: number,
  h: number
): string {
  let expr: { evaluate: (scope: Record<string, number>) => unknown };
  try {
    expr = compile(fn.expr) as typeof expr;
  } catch {
    return "";
  }
  const [x0, x1] = xDomain;
  const [y0, y1] = yDomain;
  const sx = (x: number) => ((x - x0) / (x1 - x0)) * w;
  const sy = (y: number) => h - ((y - y0) / (y1 - y0)) * h;

  let d = "";
  let pen = false;
  for (let i = 0; i <= SAMPLES; i++) {
    const x = x0 + ((x1 - x0) * i) / SAMPLES;
    let y: number;
    try {
      y = Number(expr.evaluate({ x }));
    } catch {
      pen = false;
      continue;
    }
    if (!Number.isFinite(y) || y < y0 - (y1 - y0) || y > y1 + (y1 - y0)) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${sx(x).toFixed(1)},${sy(Math.max(y0, Math.min(y1, y))).toFixed(1)}`;
    pen = true;
  }
  return d;
}

function autoYDomain(fns: Fn[], xDomain: [number, number]): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const fn of fns) {
    try {
      const expr = compile(fn.expr) as unknown as {
        evaluate: (scope: Record<string, number>) => unknown;
      };
      for (let i = 0; i <= 60; i++) {
        const x = xDomain[0] + ((xDomain[1] - xDomain[0]) * i) / 60;
        const y = Number(expr.evaluate({ x }));
        if (Number.isFinite(y)) {
          min = Math.min(min, y);
          max = Math.max(max, y);
        }
      }
    } catch {
      // ignore uncompilable fn
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return [-5, 5];
  }
  const pad = (max - min) * 0.15;
  return [min - pad, max + pad];
}

/**
 * SVG function plot. `draw` beats on "elId.fnId" animate strokeDashoffset
 * (Remotion-safe: driven by frame-derived state, not CSS animation).
 */
export const PlotEl: React.FC<{
  el: z.infer<typeof PlotElement>;
  states: Map<string, TargetState>;
  width: number;
  height: number;
}> = ({ el, states, width, height }) => {
  const pad = 44;
  const w = Math.max(50, width - pad * 2);
  const h = Math.max(50, height - pad * 2);
  const xD = el.xDomain;
  const yD = useMemo(
    () => el.yDomain ?? autoYDomain(el.fns, xD),
    [el.yDomain, el.fns, xD]
  );

  const sx = (x: number) => ((x - xD[0]) / (xD[1] - xD[0])) * w;
  const sy = (y: number) => h - ((y - yD[0]) / (yD[1] - yD[0])) * h;

  const gridLines = useMemo(() => {
    const lines: React.ReactNode[] = [];
    if (!el.showGrid) return lines;
    const xStep = niceStep(xD[1] - xD[0]);
    const yStep = niceStep(yD[1] - yD[0]);
    for (let x = Math.ceil(xD[0] / xStep) * xStep; x <= xD[1]; x += xStep) {
      lines.push(
        <line key={`gx${x}`} x1={sx(x)} y1={0} x2={sx(x)} y2={h} stroke={stage.grid} />
      );
    }
    for (let y = Math.ceil(yD[0] / yStep) * yStep; y <= yD[1]; y += yStep) {
      lines.push(
        <line key={`gy${y}`} x1={0} y1={sy(y)} x2={w} y2={sy(y)} stroke={stage.grid} />
      );
    }
    return lines;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [el.showGrid, xD, yD, w, h]);

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={width} height={height} style={{ overflow: "visible" }}>
        <g transform={`translate(${pad},${pad})`}>
          {gridLines}
          {el.showAxes && (
            <>
              {yD[0] <= 0 && yD[1] >= 0 && (
                <line x1={0} y1={sy(0)} x2={w} y2={sy(0)} stroke={stage.axis} strokeWidth={2} />
              )}
              {xD[0] <= 0 && xD[1] >= 0 && (
                <line x1={sx(0)} y1={0} x2={sx(0)} y2={h} stroke={stage.axis} strokeWidth={2} />
              )}
            </>
          )}
          {(el.lines ?? []).map((ln) => {
            const st = states.get(`${el.id}.${ln.id}`);
            const vis = st ? st.visibility : 1;
            const [x1, y1, x2, y2] =
              ln.axis === "x"
                ? [sx(ln.at), 0, sx(ln.at), h]
                : [0, sy(ln.at), w, sy(ln.at)];
            return (
              <g key={ln.id} opacity={vis}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={colors.muted} strokeWidth={2} strokeDasharray="8 6" />
                {ln.label && (
                  <text x={x2 + 8} y={ln.axis === "x" ? 18 : y2 - 8} fill={colors.muted} fontSize={22} fontFamily={fonts.ui}>
                    {ln.label}
                  </text>
                )}
              </g>
            );
          })}
          {el.fns.map((fn) => {
            const d = samplePath(fn, xD, yD, w, h);
            const st = states.get(`${el.id}.${fn.id}`);
            const progress = st ? easeOutCubic(st.enterProgress) : 1;
            const opacity = st ? Math.min(1, st.visibility * 2) * (st.dimmed ? 0.25 : 1) : 1;
            // Approximate path length for dash animation; generous upper bound.
            const approxLen = (w + h) * 2.4;
            return (
              <path
                key={fn.id}
                d={d}
                fill="none"
                stroke={colors[fn.color]}
                strokeWidth={5}
                strokeLinecap="round"
                opacity={opacity}
                strokeDasharray={progress < 1 ? approxLen : undefined}
                strokeDashoffset={progress < 1 ? approxLen * (1 - progress) : undefined}
              />
            );
          })}
          {(el.points ?? []).map((pt) => {
            const st = states.get(`${el.id}.${pt.id}`);
            const vis = st ? st.visibility : 1;
            const scale = st ? 0.5 + easeOutCubic(st.enterProgress) * 0.5 : 1;
            return (
              <g key={pt.id} opacity={vis} transform={`translate(${sx(pt.x)},${sy(pt.y)})`}>
                <circle r={10 * scale} fill={colors[pt.color]} />
                {pt.label && (
                  <text x={16} y={-12} fill={stage.ink} fontSize={26} fontFamily={fonts.serif} fontStyle="italic">
                    {pt.label}
                  </text>
                )}
              </g>
            );
          })}
          {el.fns.filter((f) => f.label).map((fn, i) => (
            <text key={`lbl-${fn.id}`} x={w - 12} y={24 + i * 32} textAnchor="end" fill={colors[fn.color]} fontSize={24} fontFamily={fonts.serif} fontStyle="italic">
              {fn.label}
            </text>
          ))}
        </g>
      </svg>
    </div>
  );
};

function niceStep(range: number): number {
  const raw = range / 8;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  if (norm < 1.5) return mag;
  if (norm < 3.5) return 2 * mag;
  if (norm < 7.5) return 5 * mag;
  return 10 * mag;
}
