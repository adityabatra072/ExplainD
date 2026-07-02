import React from "react";
import katex from "katex";
import type { z } from "zod";
import type { TextElement } from "@/lib/spec/schema";
import { colors, fonts } from "../theme";

const SIZES = { lg: 40, md: 32, sm: 24 } as const;

/** Minimal rich text: **bold**, *italic*, $inline latex$. */
export function renderRichText(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  // Split on $...$ first (math), then handle bold/italic inside text runs.
  const mathSplit = text.split(/(\$[^$]+\$)/g);
  mathSplit.forEach((chunk, i) => {
    if (chunk.startsWith("$") && chunk.endsWith("$") && chunk.length > 2) {
      const html = katex.renderToString(chunk.slice(1, -1), {
        throwOnError: false,
        output: "html",
      });
      out.push(
        <span key={i} dangerouslySetInnerHTML={{ __html: html }} />
      );
      return;
    }
    const parts = chunk.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
    parts.forEach((p, j) => {
      if (p.startsWith("**") && p.endsWith("**")) {
        out.push(<strong key={`${i}-${j}`}>{p.slice(2, -2)}</strong>);
      } else if (p.startsWith("*") && p.endsWith("*") && p.length > 2) {
        out.push(<em key={`${i}-${j}`}>{p.slice(1, -1)}</em>);
      } else if (p) {
        out.push(<React.Fragment key={`${i}-${j}`}>{p}</React.Fragment>);
      }
    });
  });
  return out;
}

export const TextEl: React.FC<{ el: z.infer<typeof TextElement> }> = ({
  el,
}) => (
  <div
    style={{
      fontFamily: fonts.serif,
      fontSize: SIZES[el.size],
      color: colors[el.color],
      lineHeight: 1.5,
      display: "flex",
      alignItems: "center",
      justifyContent: el.align === "center" ? "center" : "flex-start",
      textAlign: el.align,
      width: "100%",
      height: "100%",
    }}
  >
    <div>{renderRichText(el.text)}</div>
  </div>
);
