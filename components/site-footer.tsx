import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="page footer-inner">
        <span>
          OnchainRouter · built by{" "}
          <a href="https://github.com/web3xDev" target="_blank" rel="noreferrer" className="footer-by">
            web3xDev
          </a>
        </span>
        <div className="footer-links">
          <Link href="/connect">Connect an agent</Link>
          <Link href="/submit">Submit a tool</Link>
          <a
            href="https://github.com/web3xDev/onchain-router"
            target="_blank"
            rel="noreferrer"
          >
            Source
          </a>
        </div>
      </div>
    </footer>
  );
}
