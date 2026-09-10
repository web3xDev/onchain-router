import type { Metadata } from "next";
import Link from "next/link";
import { TOOLS } from "@/lib/tools/registry";
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
  const base = siteUrl();

  return (
    <div className="page prose prose-wide">
      <div className="page-head">
        <span className="label">Connect</span>
        <h1>One URL, {TOOLS.length} tools, no account</h1>
        <p>Add the endpoint. Your agent sees every tool, calls one, pays for it, gets the answer.</p>
      </div>

      <h2>The endpoint</h2>
      <pre className="code">{`${base}/mcp`}</pre>

      <div className="two-up" style={{ marginTop: 36, alignItems: "start" }}>
        <div>
          <h2 style={{ marginTop: 0 }}>Your own agent</h2>
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
        </div>

        <div>
          <h2 style={{ marginTop: 0 }}>Claude Code</h2>
          <p>The router, plus a wallet MCP that signs when a tool asks for payment.</p>
          <pre className="code">
            {`claude mcp add --transport http onchain-router ${base}/mcp

claude mcp add onchain-wallet -- \\
  sh -c "cd onchain-router && npx tsx mcp/wallet.ts"`}
          </pre>
        </div>
      </div>

      <h2>The wallet</h2>
      <p>
        Your agent&apos;s wallet signs every payment; the router never holds a key. The wallet
        in the repo is a reference, backed by a Circle agent wallet or a local key. Any wallet
        that signs x402 requests works in its place. Setup and caps are in the{" "}
        <a
          href="https://github.com/web3xDev/onchain-router#readme"
          target="_blank"
          rel="noreferrer"
          style={{ color: "var(--accent)" }}
        >
          README
        </a>
        .
      </p>

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
