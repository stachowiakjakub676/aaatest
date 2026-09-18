import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  // Relative base so the built page works from any path (file://, artifact hosting, Tauri).
  base: "./",
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1200, // three.js alone is ~600 kB; code-splitting buys nothing for a single-page tool
    rollupOptions: {
      output: {
        // One JS chunk so scripts/inline-build.mjs can produce a single-file HTML.
        inlineDynamicImports: true,
      },
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
