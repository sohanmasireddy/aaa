import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  base: "./", // works on Cloudflare Pages and GitHub Pages (project sites)
  plugins: [svelte()],
  worker: { format: "es" },
  build: { target: "esnext" },
});
