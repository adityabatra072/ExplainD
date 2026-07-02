import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native/binary-shipping packages must stay external to the server
  // bundle: better-sqlite3 (native addon), Remotion renderer/bundler
  // (platform binaries + headless Chrome), msedge-tts (ws streams).
  serverExternalPackages: [
    "better-sqlite3",
    "@remotion/renderer",
    "@remotion/bundler",
    "msedge-tts",
    "esbuild",
  ],
};

export default nextConfig;
