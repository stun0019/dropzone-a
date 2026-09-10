import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: {
        main: resolve("index.html"),
        legacy: resolve("dropzone-lite.html"),
      },
      output: { manualChunks: { three: ["three"] } },
    },
  },
});
