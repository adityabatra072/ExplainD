import React from "react";
import type { z } from "zod";
import type { NumberLineElement } from "@/lib/spec/schema";
import type { TargetState } from "../effects/useBeat";
import { colors, fonts, stage } from "../theme";
import { easeOutCubic } from "../effects/presets";

export const NumberLineEl: React.FC<{
  el: z.infer<typeof NumberLineElement>;
  states: Map<string, TargetState>;
  width: number;
  height: number;
}> = ({ el, states, width, height }) => {
  const pad = 60;
  const w = width - pad * 2;
  const midY = height / 2;
  const sx = (v: number) => pad + ((v - el.min) / (el.max - el.min)) * w;

  const range = el.max - el.min;
  const step = range / Math.min(10, Math.max(2, Math.round(range)));
  const ticks: number[] = [];
  for (let v = el.min; v <= el.max + 1e-9; v += step) ticks.push(Number(v.toFixed(6)));

  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <line x1={pad - 20} y1={midY} x2={pad + w + 20} y2={midY} stroke={stage.axis} strokeWidth={3} />
      {ticks.map((v) => (
        <g key={v}>
          <line x1={sx(v)} y1={midY - 10} x2={sx(v)} y2={midY + 10} stroke={stage.axis} strokeWidth={2} />
          <text x={sx(v)} y={midY + 44} textAnchor="middle" fill={colors.muted} fontSize={24} fontFamily={fonts.mono}>
            {v}
          </text>
        </g>
      ))}
      {el.marks.map((m) => {
        const st = states.get(`${el.id}.${m.id}`);
        const vis = st ? st.visibility : 1;
        const pop = st ? easeOutCubic(st.enterProgress) : 1;
        const emph = st ? st.emphasis : 0;
        return (
          <g key={m.id} opacity={vis} transform={`translate(${sx(m.at)},${midY})`}>
            <circle r={(12 + emph * 5) * pop} fill={colors[m.color]} />
            {m.label && (
              <text y={-28} textAnchor="middle" fill={colors[m.color]} fontSize={28} fontFamily={fonts.serif} fontStyle="italic">
                {m.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};
