import React, { useMemo } from "react";
import dagre from "@dagrejs/dagre";
import type { z } from "zod";
import type { DiagramElement } from "@/lib/spec/schema";
import type { TargetState } from "../effects/useBeat";
import { colors, fonts, stage } from "../theme";

const NODE_W = 220;
const NODE_H = 72;

/**
 * Flowchart with dagre auto-layout. The LLM only names nodes and edges;
 * geometry is entirely ours. Nodes fade in staggered with the element.
 */
export const DiagramEl: React.FC<{
  el: z.infer<typeof DiagramElement>;
  state: TargetState | undefined;
  width: number;
  height: number;
}> = ({ el, state, width, height }) => {
  const layout = useMemo(() => {
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: el.direction, nodesep: 48, ranksep: 64 });
    g.setDefaultEdgeLabel(() => ({}));
    for (const n of el.nodes) g.setNode(n.id, { width: NODE_W, height: NODE_H });
    for (const e of el.edges) g.setEdge(e.from, e.to);
    dagre.layout(g);
    const gw = (g.graph().width ?? NODE_W) || NODE_W;
    const gh = (g.graph().height ?? NODE_H) || NODE_H;
    return { g, gw, gh };
  }, [el]);

  const { g, gw, gh } = layout;
  const scale = Math.min(width / (gw + 40), height / (gh + 40), 1.2);
  const enter = state ? state.enterProgress : 1;

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={gw * scale} height={gh * scale} viewBox={`0 0 ${gw} ${gh}`} style={{ overflow: "visible" }}>
        <defs>
          <marker id={`arr-${el.id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={colors.muted} />
          </marker>
        </defs>
        {el.edges.map((e, i) => {
          const edge = g.edge(e.from, e.to);
          if (!edge) return null;
          const pts = edge.points;
          const d = pts
            .map(
              (p: { x: number; y: number }, j: number) =>
                `${j === 0 ? "M" : "L"}${p.x},${p.y}`
            )
            .join("");
          const edgeVis = Math.max(0, Math.min(1, enter * (el.nodes.length + el.edges.length) - el.nodes.length - i));
          return (
            <g key={`${e.from}-${e.to}`} opacity={edgeVis}>
              <path d={d} fill="none" stroke={colors.muted} strokeWidth={2.5} markerEnd={`url(#arr-${el.id})`} />
              {e.label && (
                <text x={pts[Math.floor(pts.length / 2)].x + 10} y={pts[Math.floor(pts.length / 2)].y - 6} fill={colors.muted} fontSize={20} fontFamily={fonts.ui}>
                  {e.label}
                </text>
              )}
            </g>
          );
        })}
        {el.nodes.map((n, i) => {
          const node = g.node(n.id);
          if (!node) return null;
          const nodeVis = Math.max(0, Math.min(1, enter * (el.nodes.length + el.edges.length) - i));
          const x = node.x - NODE_W / 2;
          const y = node.y - NODE_H / 2;
          const isDiamond = n.kind === "diamond";
          return (
            <g key={n.id} opacity={nodeVis} transform={`translate(${x},${y})`}>
              {isDiamond ? (
                <polygon
                  points={`${NODE_W / 2},0 ${NODE_W},${NODE_H / 2} ${NODE_W / 2},${NODE_H} 0,${NODE_H / 2}`}
                  fill="rgba(255,255,255,0.04)"
                  stroke={colors[n.color]}
                  strokeWidth={2.5}
                />
              ) : (
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx={n.kind === "pill" ? NODE_H / 2 : 10}
                  fill="rgba(255,255,255,0.04)"
                  stroke={colors[n.color]}
                  strokeWidth={2.5}
                />
              )}
              <text x={NODE_W / 2} y={NODE_H / 2 + 8} textAnchor="middle" fill={stage.ink} fontSize={24} fontFamily={fonts.ui}>
                {n.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
