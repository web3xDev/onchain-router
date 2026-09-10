import type { Metadata } from "next";
import Link from "next/link";
import { TOOLS } from "@/lib/tools/registry";
import { rails } from "@/lib/x402";
import { siteUrl } from "@/lib/site";

const DESCRIPTION =
  "One MCP URL. Your agent discovers the tools, calls the one it needs and pays for that call from its own wallet.";

export const metadata: Metadata = {
  title: "Connect your agent",
  description: DESCRIPTION,
  openGraph: { title: "Connect your agent", description: DESCRIPTION },
  twitter: { title: "Connect your agent", description: DESCRIPTION },
};

export default function ConnectPage() {
  const live = rails();
  const base = siteUrl();

  return (
    <div className="page prose">
      <div className="page-head">
        <span className="label">Connect</span>
        <h1>One URL, {TOOLS.length} tools, no account</h1>
        <p>
          The router is an MCP server at a URL. Point your agent at it and it sees every
          tool with its price. When it calls one, it pays for that call from its own wallet
          and gets the answer. Nothing to sign up for.
        </p>
      </div>

      <h2>The endpoint</h2>
      <pre className="code">{`${base}/mcp`}</pre>
      <p>
        Listing tools is free. Calling one returns a payment-required error carrying the
        accepted networks; an x402-aware client signs and calls again. That round trip is
        handled by the client library, so from the agent&apos;s side it is one call.
      </p>

      <h2>From your own agent</h2>
      <p>
        Wrap a standard MCP client with an x402 payment client and a wallet. This is the
        whole integration:
      </p>
      <pre className="code">
        {`import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { wrapMCPClientWithPayment } from "@x402/mcp";

// paymentClient: an x402Client with your wallet registered.
// Hedera Agent Kit, Circle agent wallet, or a local key all work.
const agent = wrapMCPClientWithPayment(
  new Client({ name: "my-agent", version: "1.0.0" }),
  paymentClient,
);

await agent.connect(new StreamableHTTPClientTransport(new URL("${base}/mcp")));

const result = await agent.callTool("lending_rates", { asset: "USDC", chain: "base" });
// result.paymentMade === true, result.paymentResponse has the receipt`}
      </pre>
      <p>
        The repo has a working version of exactly this at{" "}
        <code>scripts/mcp-remote-check.ts</code>. Run <code>npm run mcp:remote</code> with a
        wallet in <code>.env.local</code> and watch it pay.
      </p>

      <h2>From Claude Code or Claude Desktop</h2>
      <p>
        A chat client cannot sign a payment itself, so it needs a wallet beside it. Run the
        local server from a checkout and give it one; it pays on Claude&apos;s behalf from
        the wallet you configure, and Claude just calls the tool.
      </p>
      <pre className="code">
        {`git clone https://github.com/web3xDev/onchain-router
cd onchain-router && npm install
cp .env.example .env.local    # add a wallet
claude                        # .mcp.json in the repo registers the server`}
      </pre>
      <p>Or register it anywhere by hand:</p>
      <pre className="code">
        {`claude mcp add onchain-router -- sh -c "cd /path/to/onchain-router && npx tsx mcp/server.ts"`}
      </pre>

      <h2>Who signs</h2>
      <p>
        The money is always the caller&apos;s. The only question is which process holds the
        signing material.
      </p>

      <div className="callout">
        <strong style={{ color: "var(--text)" }}>Your agent, its own wallet.</strong>
        <br />
        The remote endpoint above. The router never sees a key; it sees a signed payment
        and settles it.
      </div>

      <div className="callout">
        <strong style={{ color: "var(--text)" }}>Circle agent wallet (recommended for the local server).</strong>
        <br />
        Give the local server a Circle wallet id and API credentials. Signing happens
        inside Circle, so the private key never reaches your machine, and the payment
        layer cannot tell the difference between that and a local key.
      </div>

      <div className="callout">
        <strong style={{ color: "var(--text)" }}>Local key.</strong>
        <br />
        A Hedera account and key in the local server&apos;s environment. Simplest to set
        up, and the key sits on your machine, which is the trade you are making.
      </div>

      <h2>Fund it</h2>
      <p>
        Every call is priced in cents, so a few dollars of testnet funds lasts a long time.
        Per-payment caps stop an agent spending past what you set.
      </p>
      <pre className="code">
        {live
          .map((rail) => `${rail.name.padEnd(16)} ${rail.amount} per call → ${rail.payTo}`)
          .join("\n") || "No rail configured on this deployment."}
      </pre>

      <h2>Then ask</h2>
      <pre className="code">
        {`"Where should I lend USDC on Base right now, and is the
 best rate actually backed by liquidity?"

 → agent calls lending_rates
 → payment required, agent signs from its own wallet
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
