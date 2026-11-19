import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// transformers.js loads the ONNX runtime .wasm from the jsDelivr CDN at runtime,
// so the bundled copy is never used. Dropping it keeps every asset under
// Cloudflare's 25 MiB per-file limit.
const dropWasm = () => ({
  name: "drop-wasm",
  generateBundle(_, bundle) {
    for (const key of Object.keys(bundle)) {
      if (key.endsWith(".wasm")) delete bundle[key];
    }
  },
});

export default defineConfig({
  base: "./", // works on Cloudflare and GitHub Pages
  plugins: [svelte(), dropWasm()],
  worker: { format: "es", plugins: () => [dropWasm()] },
  build: { target: "esnext" },
});
