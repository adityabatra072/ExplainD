import React from "react";
import type { z } from "zod";
import type { CodeElement } from "@/lib/spec/schema";
import type { TargetState } from "../effects/useBeat";
import { colors, fonts, stage } from "../theme";

/**
 * Code block with line numbers. Highlight beats ("elId.hlId") wash the
 * covered lines with the accent color.
 */
export const CodeEl: React.FC<{
  el: z.infer<typeof CodeElement>;
  states: Map<string, TargetState>;
}> = ({ el, states }) => {
  const lines = el.code.replace(/\t/g, "  ").split("\n");

  const lineWash = (lineNo: number): number => {
    let wash = 0;
    for (const hl of el.highlights ?? []) {
      const st = states.get(`${el.id}.${hl.id}`);
      if (!st) continue;
      if (lineNo >= hl.lines[0] && lineNo <= hl.lines[1]) {
        wash = Math.max(wash, st.highlight, st.visibility > 0 && st.enterProgress < 1 ? st.enterProgress : 0);
      }
    }
    return wash;
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          fontFamily: fonts.mono,
          fontSize: 26,
          lineHeight: 1.65,
          background: "rgba(0,0,0,0.35)",
          border: `1px solid ${stage.hairline}`,
          borderRadius: 8,
          padding: "28px 36px",
          color: stage.ink,
          maxWidth: "100%",
          overflow: "hidden",
        }}
      >
        {lines.map((line, i) => {
          const wash = lineWash(i + 1);
          return (
            <div
              key={i}
              style={{
                display: "flex",
                background:
                  wash > 0 ? `rgba(245,166,35,${0.16 * wash})` : undefined,
                borderLeft:
                  wash > 0
                    ? `3px solid rgba(245,166,35,${wash})`
                    : "3px solid transparent",
                paddingLeft: 12,
                marginLeft: -15,
              }}
            >
              <span
                style={{
                  color: colors.muted,
                  width: "2.2em",
                  userSelect: "none",
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </span>
              <span style={{ whiteSpace: "pre" }}>{line || " "}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
