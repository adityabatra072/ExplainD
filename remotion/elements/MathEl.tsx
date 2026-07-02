import React from "react";
import katex from "katex";
import type { z } from "zod";
import type { MathElement } from "@/lib/spec/schema";
import type { TargetState } from "../effects/useBeat";
import { stage } from "../theme";

const SIZES = { lg: 3.0, md: 2.2, sm: 1.6 } as const;

/**
 * Display math. When `parts` exist, each part is a span whose opacity is
 * driven by its own beat target ("elId.partId") — part-by-part reveal.
 */
export const MathEl: React.FC<{
  el: z.infer<typeof MathElement>;
  states: Map<string, TargetState>;
}> = ({ el, states }) => {
  const scale = SIZES[el.size];

  if (!el.parts || el.parts.length === 0) {
    const html = katex.renderToString(el.latex, {
      throwOnError: false,
      displayMode: true,
      output: "html",
    });
    return (
      <div style={wrap(scale)}>
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    );
  }

  return (
    <div style={{ ...wrap(scale), gap: "0.35em" }}>
      {el.parts.map((part) => {
        const st = states.get(`${el.id}.${part.id}`);
        const opacity = st ? st.visibility : 1;
        const html = katex.renderToString(part.latex, {
          throwOnError: false,
          displayMode: false,
          output: "html",
        });
        return (
          <span
            key={part.id}
            style={{ opacity, transition: "none" }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </div>
  );
};

const wrap = (scale: number): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  height: "100%",
  fontSize: `${scale}em`,
  color: stage.ink,
});
