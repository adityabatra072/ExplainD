import path from "node:path";
import type { WebpackOverrideFn } from "@remotion/bundler";

/** Teach the Remotion bundler the "@/" tsconfig path alias. */
export const webpackOverride: WebpackOverrideFn = (config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: {
      ...(config.resolve?.alias ?? {}),
      "@": path.join(process.cwd()),
    },
  },
});
