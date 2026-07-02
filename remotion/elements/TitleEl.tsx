import React from "react";
import type { z } from "zod";
import type { TitleElement } from "@/lib/spec/schema";
import { fonts, stage } from "../theme";

const SIZES = { hero: 92, lg: 64, md: 44 } as const;

export const TitleEl: React.FC<{ el: z.infer<typeof TitleElement> }> = ({
  el,
}) => (
  <div
    style={{
      fontFamily: fonts.serif,
      fontSize: SIZES[el.size],
      fontWeight: 600,
      color: stage.ink,
      lineHeight: 1.15,
      letterSpacing: "-0.01em",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      width: "100%",
      height: "100%",
    }}
  >
    {el.text}
  </div>
);
