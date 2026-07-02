import React from "react";
import type { z } from "zod";
import type { TableElement } from "@/lib/spec/schema";
import type { TargetState } from "../effects/useBeat";
import { colors, fonts, stage } from "../theme";

/** Table with row-by-row staggered reveal driven by element enter progress. */
export const TableEl: React.FC<{
  el: z.infer<typeof TableElement>;
  state: TargetState | undefined;
}> = ({ el, state }) => {
  const enter = state ? state.enterProgress : 1;
  const total = el.rows.length + 1;

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <table
        style={{
          fontFamily: fonts.ui,
          fontSize: 28,
          color: stage.ink,
          borderCollapse: "collapse",
        }}
      >
        <thead>
          <tr style={{ opacity: Math.min(1, enter * total) }}>
            {el.headers.map((h, i) => (
              <th
                key={i}
                style={{
                  padding: "14px 32px",
                  borderBottom: `2px solid ${colors.accent}`,
                  color: colors.accent,
                  fontWeight: 600,
                  textAlign: "left",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {el.rows.map((row, r) => (
            <tr key={r} style={{ opacity: Math.max(0, Math.min(1, enter * total - (r + 1))) }}>
              {row.map((cell, c) => (
                <td
                  key={c}
                  style={{
                    padding: "12px 32px",
                    borderBottom: `1px solid ${stage.hairline}`,
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
