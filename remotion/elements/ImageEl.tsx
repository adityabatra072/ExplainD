import React from "react";
import type { z } from "zod";
import type { ImageElement } from "@/lib/spec/schema";
import { fonts, stage } from "../theme";

/** v1: a styled placeholder card. Swappable for a real image search later. */
export const ImageEl: React.FC<{ el: z.infer<typeof ImageElement> }> = ({
  el,
}) => (
  <div
    style={{
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    }}
  >
    <div
      style={{
        width: "100%",
        height: "100%",
        border: `1px dashed ${stage.hairline}`,
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={stage.inkDim} strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
      <div
        style={{
          fontFamily: fonts.ui,
          fontSize: 24,
          color: stage.inkDim,
          textAlign: "center",
          maxWidth: "80%",
        }}
      >
        {el.alt}
      </div>
    </div>
  </div>
);
