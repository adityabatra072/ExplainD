import React from "react";
import type { z } from "zod";
import type { ShapeElement } from "@/lib/spec/schema";
import type { TargetState } from "../effects/useBeat";
import { colors, fonts, stage } from "../theme";
import { easeOutCubic } from "../effects/presets";

/** Basic geometric shape in its region, drawn as SVG with draw-in support. */
export const ShapeEl: React.FC<{
  el: z.infer<typeof ShapeElement>;
  state: TargetState | undefined;
  width: number;
  height: number;
}> = ({ el, state, width, height }) => {
  const stroke = colors[el.stroke];
  const fill = el.fill ? colors[el.fill] : "none";
  const fillOpacity = el.fill ? 0.18 : 0;
  const progress = state ? easeOutCubic(state.enterProgress) : 1;
  const pad = 16;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const perimeter = (w + h) * 2.2;
  const dash =
    progress < 1
      ? { strokeDasharray: perimeter, strokeDashoffset: perimeter * (1 - progress) }
      : {};

  const toPx = ([x, y]: [number, number]): [number, number] => [
    pad + (x / 100) * w,
    pad + (y / 100) * h,
  ];

  let shapeNode: React.ReactNode = null;
  switch (el.shape) {
    case "circle": {
      const r = Math.min(w, h) / 2;
      shapeNode = <circle cx={pad + w / 2} cy={pad + h / 2} r={r} fill={fill} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={4} {...dash} />;
      break;
    }
    case "ellipse":
      shapeNode = <ellipse cx={pad + w / 2} cy={pad + h / 2} rx={w / 2} ry={h / 2} fill={fill} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={4} {...dash} />;
      break;
    case "rect":
      shapeNode = <rect x={pad} y={pad} width={w} height={h} rx={6} fill={fill} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={4} {...dash} />;
      break;
    case "triangle": {
      const pts = [
        [50, 0],
        [100, 100],
        [0, 100],
      ].map((p) => toPx(p as [number, number]).join(","));
      shapeNode = <polygon points={pts.join(" ")} fill={fill} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={4} strokeLinejoin="round" {...dash} />;
      break;
    }
    case "polygon": {
      const pts = (el.points ?? []).map((p) => toPx(p).join(",")).join(" ");
      shapeNode = <polygon points={pts} fill={fill} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={4} strokeLinejoin="round" {...dash} />;
      break;
    }
    case "line": {
      const pts = el.points ?? [
        [0, 50],
        [100, 50],
      ];
      const [a, b] = [toPx(pts[0]), toPx(pts[pts.length - 1])];
      shapeNode = <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={stroke} strokeWidth={4} strokeLinecap="round" {...dash} />;
      break;
    }
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <svg width={width} height={height} style={{ overflow: "visible" }}>
        {shapeNode}
      </svg>
      {el.label && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: fonts.serif,
            fontSize: 30,
            color: stage.ink,
            pointerEvents: "none",
          }}
        >
          {el.label}
        </div>
      )}
    </div>
  );
};
