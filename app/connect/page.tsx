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
        A chat client does not sign anything itself, but it does not need to: give it a
        wallet as a second MCP server. When a tool answers &quot;payment required&quot;,
        Claude hands the request to the wallet, gets a signature back, and calls the tool
        again with it. The router never sees a key. The wallet never sees the router.
      </p>
      <pre className="code">
        {`claude mcp add --transport http onchain-router ${base}/mcp
claude mcp add onchain-wallet -- sh -c "cd /path/to/onchain-router && npx tsx mcp/wallet.ts"`}
      </pre>
      <p>
        <code>mcp/wallet.ts</code> is a reference wallet: one tool, <code>sign_x402_payment</code>,
        backed by whatever is in <code>.env.local</code>. Any wallet MCP that signs x402 requests
        works in its place. <code>npm run mcp:wallet:check</code> replays the three steps a chat
        client would take, with no x402 library on the client side at all.
      </p>
      <h2>Who signs</h2>
      <p>
        Always the agent&apos;s own wallet. The router holds no keys and no balances; it
        receives a signed payment inside the call and settles it. What the wallet is
        backed by is the agent&apos;s choice.
      </p>

      <div className="callout">
        <strong style={{ color: "var(--text)" }}>Circle agent wallet.</strong>
        <br />
        The reference wallet takes a Circle wallet id and API credentials. Signing happens
        inside Circle, so the private key never reaches the machine the agent runs on.
      </div>

      <div className="callout">
        <strong style={{ color: "var(--text)" }}>Local key.</strong>
        <br />
        A Hedera account and key, or an Arc key, in the wallet&apos;s environment. Simplest
        to set up, and the key sits on that machine, which is the trade you are making.
      </div>

      <div className="callout">
        <strong style={{ color: "var(--text)" }}>Any other x402 wallet.</strong>
        <br />
        The router speaks standard x402. A wallet MCP or an x402 client from anywhere
        else works in place of the reference one; nothing here is specific to it.
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
