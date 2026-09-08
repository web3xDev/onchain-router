"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Tools" },
  { href: "/playground", label: "Playground" },
  { href: "/connect", label: "Connect" },
  { href: "/submit", label: "Submit a tool" },
];

export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav className="nav">
      <div className="page nav-inner">
        <Link href="/" className="brand">
          <span className="brand-mark">R</span>
          Onchain Router
        </Link>

        <div className="nav-links">
          {LINKS.map((link) => {
            // "/" is the catalogue, so a tool detail page keeps Tools lit.
            const active =
              link.href === "/"
                ? pathname === "/" || pathname.startsWith("/tools")
                : pathname.startsWith(link.href);

            return (
              <Link key={link.href} href={link.href} className={active ? "active" : undefined}>
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="nav-right">
          <a
            className="btn btn-sm"
            href="https://github.com/web3xDev/onchain-router"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </div>
      </div>
    </nav>
  );
}
