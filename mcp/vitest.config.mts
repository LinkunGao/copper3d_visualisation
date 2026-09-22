import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // A stdio MCP server is a plain Node process -- no DOM here, unlike the
    // jsdom setup the copper3d package itself uses.
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
  },
});
