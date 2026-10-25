import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    // 本物の ~/.tazuna/config.json を読み書きしないよう、作れない場所を指す（F-18）
    env: { TAZUNA_CONFIG: "/dev/null/tazuna-test/config.json" },
  },
});
