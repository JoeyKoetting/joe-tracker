// @ts-check
import node from "@astrojs/node";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  trailingSlash: "never",
  output: "server",
  adapter: node({ mode: "standalone" }),
  prefetch: {
    prefetchAll: true,
    defaultStrategy: "viewport",
  },
  vite: {
    plugins: [/** @type {any} */ (tailwindcss())],
  },
});
