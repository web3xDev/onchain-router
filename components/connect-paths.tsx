"use client";

import { useState } from "react";

type Path = "sdk" | "claude";

export function ConnectPaths({ base }: { base: string }) {
  const [path, setPath] = useState<Path>("sdk");

  return (
    <div>
      <div className="segmented" style={{ marginBottom: 16 }}>
        <button type="button" aria-pressed={path === "sdk"} onClick={() => setPath("sdk")}>
          Your own agent
        </button>
        <button type="button" aria-pressed={path === "claude"} onClick={() => setPath("claude")}>
          Claude Code
        </button>
      </div>

      {path === "sdk" ? (
        <>
          <p>Wrap an MCP client with an x402 payment client and your wallet.</p>
          <pre className="code">
            {`const agent = wrapMCPClientWithPayment(
  new Client({ name: "my-agent", version: "1.0.0" }),
  paymentClient, // your x402Client + wallet
);

await agent.connect(
  new StreamableHTTPClientTransport(new URL("${base}/mcp")),
);

await agent.callTool("lending_rates", { asset: "USDC", chain: "base" });`}
          </pre>
        </>
      ) : (
        <>
          <p>The router, plus a wallet MCP that signs when a tool asks for payment.</p>
          <pre className="code">
            {`claude mcp add --transport http onchain-router ${base}/mcp

claude mcp add onchain-wallet -- \\
  sh -c "cd onchain-router && npx tsx mcp/wallet.ts"`}
          </pre>
        </>
      )}
    </div>
  );
}
