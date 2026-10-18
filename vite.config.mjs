import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

const uiRoot = resolve(import.meta.dirname, "src/ui");

export default defineConfig({
  root: uiRoot,
  base: "./",
  plugins: [react()],
  input: {
    index: resolve(uiRoot, "index.html"),
    market: resolve(uiRoot, "market.html"),
    home: resolve(uiRoot, "home.html"),
  },
  build: {
    outDir: resolve(import.meta.dirname, "dist-ui"),
    emptyOutDir: true,
  },
});
