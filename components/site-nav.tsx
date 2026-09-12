"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";

const LINKS = [
  { href: "/tools", label: "Tools" },
  { href: "/playground", label: "Playground" },
  { href: "/connect", label: "Connect" },
  { href: "/submit", label: "Submit a tool" },
];

const GITHUB = "https://github.com/web3xDev/onchain-router";

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Navigating closes the drawer; so does Escape. Body scroll is held while open.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  // The drawer sits outside the nav: the nav's backdrop-filter would otherwise make
  // it the containing block for a fixed child, and the drawer would size to it.
  return (
    <>
    <nav className="nav">
      <div className="page nav-inner">
        <Link href="/" className="brand">
          <Logo size={22} />
          OnchainRouter
        </Link>

        <div className="nav-links">
          {LINKS.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link key={link.href} href={link.href} className={active ? "active" : undefined}>
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="nav-right">
          <a className="btn btn-sm btn-icon" href={GITHUB} target="_blank" rel="noreferrer" aria-label="GitHub" title="GitHub">
            <GitHubIcon />
          </a>
          <button
            type="button"
            className={`btn btn-sm btn-icon nav-burger${open ? " is-open" : ""}`}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="nav-drawer"
            onClick={() => setOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>
    </nav>

      <div className={`nav-scrim${open ? " is-open" : ""}`} onClick={() => setOpen(false)} aria-hidden="true" />

      <div id="nav-drawer" className={`nav-drawer${open ? " is-open" : ""}`} inert={!open}>
        {LINKS.map((link) => {
          const active = pathname.startsWith(link.href);
          return (
            <Link key={link.href} href={link.href} className={active ? "active" : undefined}>
              {link.label}
            </Link>
          );
        })}
        <a href={GITHUB} target="_blank" rel="noreferrer" className="nav-drawer-github">
          <GitHubIcon />
          GitHub
        </a>
      </div>
    </>
  );
}
