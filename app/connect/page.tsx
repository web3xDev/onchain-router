import type { Metadata } from "next";
import Link from "next/link";
import { TOOLS } from "@/lib/tools/registry";
import { rails } from "@/lib/x402";

export const metadata: Metadata = {
  title: "Connect your agent — Onchain Router",
  description:
    "Add the router as an MCP server and let your agent pay for onchain tools from its own wallet.",
};

export default function ConnectPage() {
  const live = rails();

  return (
    <div className="page prose">
      <div className="page-head">
        <span className="label">Connect</span>
        <h1>Give your agent onchain tools</h1>
        <p>
          One MCP server, {TOOLS.length} tools, no account to create. Your agent discovers
          what exists, decides what it needs, and pays for that call itself.
        </p>
      </div>

      <h2>1. Add the MCP server</h2>
      <p>
        Anything that speaks MCP works — Claude Code, Claude Desktop, or your own client.
        Clone the repo and point your client at the server:
      </p>
      <pre className="code">
        {`git clone https://github.com/web3xDev/onchain-router
cd onchain-router && npm install`}
      </pre>
      <pre className="code">
        {`{
  "mcpServers": {
    "onchain-router": {
      "command": "npx",
      "args": ["tsx", "mcp/server.ts"],
      "cwd": "/path/to/onchain-router",
      "env": { "ONCHAIN_ROUTER_URL": "https://onchain-router.app" }
    }
  }
}`}
      </pre>

      <h2>2. Decide who signs</h2>
      <p>
        The money is always the caller&apos;s. The only question is which process holds the
        signing material, and the router works three ways.
      </p>

      <div className="callout">
        <strong style={{ color: "var(--text)" }}>Quote only — nothing configured.</strong>
        <br />
        The tool returns the price and the accepted networks and stops. Your agent settles
        with whatever wallet it already has and calls again with the receipt. The router
        never sees a key.
      </div>

      <div className="callout">
        <strong style={{ color: "var(--text)" }}>Circle agent wallet — recommended.</strong>
        <br />
        Give the MCP server a Circle wallet id and API credentials. Signing happens inside
        Circle, so the private key never reaches your machine at all, and the payment layer
        cannot tell the difference between that and a local key.
      </div>

      <div className="callout">
        <strong style={{ color: "var(--text)" }}>Local key.</strong>
        <br />
        A Hedera account and key in the MCP server&apos;s own environment. Simplest to set
        up, and the key sits on your machine, which is the trade you are making.
      </div>

      <h2>3. Fund the wallet</h2>
      <p>
        Every call is priced in cents, so a few dollars of testnet funds lasts a long time.
        The agent will not spend past the per-payment cap you set.
      </p>
      <pre className="code">
        {live
          .map((rail) => `${rail.name.padEnd(16)} ${rail.amount} per call → ${rail.payTo}`)
          .join("\n") || "No rail configured on this deployment."}
      </pre>

      <h2>4. Ask for something onchain</h2>
      <p>
        Nothing else to wire up. Ask the agent a question a tool can answer and it will find
        the tool, pay for it and come back with the answer.
      </p>
      <pre className="code">
        {`"Where should I lend USDC on Base right now, and is the
 best rate actually backed by liquidity?"

 → agent calls lending_rates
 → 402, agent signs from its own wallet
 → answer, with the reasoning behind it`}
      </pre>

      <p style={{ marginTop: 32 }}>
        <Link href="/" className="btn">
          Browse the catalogue
        </Link>{" "}
        <Link href="/playground" className="btn">
          Try it without a wallet
        </Link>
      </p>
    </div>
  );
}
