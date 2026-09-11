import type { Metadata } from "next";
import Link from "next/link";
import { catalogue, CATEGORIES, TOOLS } from "@/lib/tools/registry";
import { ToolCatalogue } from "@/components/tool-catalogue";

const DESCRIPTION = "Every onchain tool on the router, with its price. Pay per call, no account.";

export const metadata: Metadata = {
  title: "Tools",
  description: DESCRIPTION,
  openGraph: { title: "Tools", description: DESCRIPTION },
  twitter: { title: "Tools", description: DESCRIPTION },
};

export const dynamic = "force-dynamic";

export default function ToolsPage() {
  return (
    <div className="page">
      <div className="section-head" style={{ paddingTop: 56 }}>
        <div>
          <span className="label">Tools</span>
          <h1 style={{ fontSize: 36, marginTop: 8 }}>{TOOLS.length} tools, priced per call</h1>
          <p>
            Every tool answers a question rather than returning a table. You pay when it
            answers. If it cannot give a verdict, the call is free.
          </p>
        </div>
        <Link href="/submit" className="btn btn-sm">
          Submit a tool
        </Link>
      </div>

      <div style={{ paddingBottom: 64 }}>
        <ToolCatalogue tools={catalogue()} categories={CATEGORIES} />
      </div>
    </div>
  );
}
