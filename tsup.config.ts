import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    state: "src/state/index.ts",
    seed: "src/seed/index.ts",
    trace: "src/trace/index.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  splitting: false,
});
