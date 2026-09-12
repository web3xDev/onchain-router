import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    client: "src/client.ts",
    server: "src/server.ts",
    wallet: "src/wallet.ts",
    cli: "src/cli.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "node20",
  splitting: true,
  // Dependencies stay dependencies; only this package's own code is bundled.
  external: [/^@x402\//, /^@circle-fin\//, /^@modelcontextprotocol\//, "viem", "zod"],
});
