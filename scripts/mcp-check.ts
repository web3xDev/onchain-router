import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/**
 * Speaks MCP to the router's own server the way an agent would: list what is on
 * offer, then call something and see what comes back.
 */
async function main() {
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", "mcp/server.ts"],
    env: { ...process.env, ONCHAIN_ROUTER_URL: process.env.ONCHAIN_ROUTER_URL ?? "http://localhost:3000" },
  });

  const client = new Client({ name: "mcp-check", version: "0.1.0" });
  await client.connect(transport);

  const { tools } = await client.listTools();
  console.log(`=== ${tools.length} tools offered ===`);
  for (const tool of tools) {
    console.log(`\n${tool.name}`);
    console.log(`  ${(tool.description ?? "").split(". ")[0]}.`);
    console.log(`  inputs: ${Object.keys(tool.inputSchema?.properties ?? {}).join(", ")}`);
  }

  console.log(`\n=== calling lending_rates ===`);
  const result = await client.callTool({
    name: "lending_rates",
    arguments: { asset: "USDC", chain: "ethereum" },
  });

  const content = (result.content as { type: string; text?: string }[])[0];
  console.log(content?.text ?? JSON.stringify(result));

  await client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
