import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "soul-core": resolve(__dirname, "../src/index.ts"),
    },
  },
});
