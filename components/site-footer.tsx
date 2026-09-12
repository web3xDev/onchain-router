import Link from "next/link";
import { Brand } from "@/components/brand";
import { Logo } from "@/components/logo";

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="page">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link href="/" className="brand">
              <Logo size={22} />
              OnchainRouter
            </Link>
            <p>Onchain tools for AI agents. Call a tool, pay a cent, get the result.</p>
            <div className="footer-rails">
              <span>Built with</span>
              <a href="https://hedera.com" target="_blank" rel="noreferrer" className="footer-mark" aria-label="Hedera">
                <Brand id="hedera" kind="logo" height={16} />
              </a>
              <a href="https://www.arc.network" target="_blank" rel="noreferrer" className="footer-mark" aria-label="Arc">
                <Brand id="arc" kind="logo" height={16} />
              </a>
              <a href="https://thegraph.com" target="_blank" rel="noreferrer" className="footer-mark" aria-label="The Graph">
                <Brand id="graph" kind="logo" height={16} />
              </a>
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
            <Link href="/connect#endpoint">MCP</Link>
            <Link href="/tools/lending-rates#http">API</Link>
          </div>
        </div>

        <div className="footer-bottom">
          <span>
            Built by{" "}
            <a href="https://github.com/web3xDev" target="_blank" rel="noreferrer" className="footer-by">
              web3xDev
            </a>
          </span>
          <span>
            Payments over{" "}
            <a href="https://x402.org" target="_blank" rel="noreferrer" className="footer-by">
              x402
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
