import Link from "next/link";
import { Brand } from "@/components/brand";
import { siteUrl } from "@/lib/site";

export function SiteFooter() {
  const base = siteUrl();

  return (
    <footer className="footer">
      <div className="page">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link href="/" className="brand">
              <span className="brand-mark">R</span>
              OnchainRouter
            </Link>
            <p>Onchain answers for AI agents. Call a tool, pay a cent, get a decision.</p>
            <div className="footer-rails">
              <span>Built with</span>
              <Brand id="hedera" kind="logo" height={16} />
              <Brand id="arc" kind="logo" height={16} />
              <Brand id="graph" kind="logo" height={16} />
            </div>
          </div>

          <div className="footer-col">
            <div className="footer-title">Product</div>
            <Link href="/tools">Tools</Link>
            <Link href="/playground">Playground</Link>
            <Link href="/connect">Connect an agent</Link>
            <Link href="/submit">List your endpoint</Link>
          </div>

          <div className="footer-col">
            <div className="footer-title">Developers</div>
            <a href="https://github.com/web3xDev/onchain-router" target="_blank" rel="noreferrer">
              Source
            </a>
            <a href="https://github.com/web3xDev/onchain-router#readme" target="_blank" rel="noreferrer">
              README
            </a>
            <a href={`${base}/mcp`} className="footer-mono">
              {base.replace(/^https?:\/\//, "")}/mcp
            </a>
            <a href={`${base}/api/tools`} className="footer-mono">
              {base.replace(/^https?:\/\//, "")}/api/tools
            </a>
          </div>
        </div>

        <div className="footer-bottom">
          <span>
            Built by{" "}
            <a href="https://github.com/web3xDev" target="_blank" rel="noreferrer" className="footer-by">
              web3xDev
            </a>
          </span>
          <span>Payments over x402 · AGPL-3.0</span>
        </div>
      </div>
    </footer>
  );
}
