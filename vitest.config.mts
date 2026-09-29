import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    env: {
      AUTH_SECRET: "test-secret-test-secret-test-secret-1234",
      DATABASE_URL: "pglite://memory",
    },
  },
});
