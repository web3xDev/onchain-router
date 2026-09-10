import type { Metadata } from "next";
import Link from "next/link";
import { siteUrl } from "@/lib/site";
import { ConnectPaths } from "@/components/connect-paths";

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
    <div className="page prose">
      <div className="page-head">
        <span className="label">Connect</span>
        <h1>Give your agent onchain tools</h1>
        <p>Add the endpoint. Your agent sees every tool, calls one, pays for it, gets the answer.</p>
      </div>

      <h2>The endpoint</h2>
      <pre className="code">{`${base}/mcp`}</pre>

      <h2>Connect</h2>
      <ConnectPaths base={base} />

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

      <div className="hero-actions" style={{ marginTop: 32 }}>
        <Link href="/" className="btn">
          Browse the catalogue
        </Link>
        <Link href="/playground" className="btn">
          Try it without a wallet
        </Link>
      </div>
    </div>
  );
}
