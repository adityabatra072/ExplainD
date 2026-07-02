import { registerRoot } from "remotion";
// KaTeX styles must ship inside the bundle for server-side MP4 rendering
// (the Next app gets them from app/layout.tsx instead).
import "katex/dist/katex.min.css";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
