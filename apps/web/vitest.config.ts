import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules", ".next", "tests/e2e"],
    coverage: {
      provider: "v8",
      include: ["src/services/**", "src/repositories/**"],
      exclude: ["**/*.test.ts"],
      thresholds: { lines: 80 },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
      "@schmittnet/types": resolve(__dirname, "../../packages/types/src/index.ts"),
      "@schmittnet/utils": resolve(__dirname, "../../packages/utils/src/index.ts"),
    },
  },
});
