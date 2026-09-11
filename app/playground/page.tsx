import type { Metadata } from "next";
import { describeInputs, TOOLS } from "@/lib/tools/registry";
import { rails } from "@/lib/x402";
import { Playground } from "@/components/playground";

const DESCRIPTION =
  "Call a paid onchain tool and watch a real payment settle, without needing a wallet.";

export const metadata: Metadata = {
  title: "Playground",
  description: DESCRIPTION,
  openGraph: { title: "Playground", description: DESCRIPTION },
  twitter: { title: "Playground", description: DESCRIPTION },
};

export default async function PlaygroundPage({
  searchParams,
}: {
  searchParams: Promise<{ tool?: string }>;
}) {
  const requested = (await searchParams).tool;

  // The demo wallet signs on the router's own rails. A listed endpoint names its
  // own, which the demo wallet may not hold, so only hosted tools are offered here.
  const tools = TOOLS.filter((tool) => !tool.endpoint).map((tool) => ({
    slug: tool.slug,
    name: tool.name,
    price: tool.price,
    summary: tool.summary,
    inputs: describeInputs(tool),
    example: tool.example.request,
  }));

  return (
    <div className="page">
      <div className="page-head" style={{ paddingBottom: 32 }}>
        <span className="label">Playground</span>
        <h1>Watch an agent pay for an answer</h1>
        <p style={{ maxWidth: "none", whiteSpace: "nowrap" }}>
          A real x402 payment on testnet, paid from our wallet so you can try it without one.
        </p>
      </div>

      <Playground
        tools={tools}
        rails={rails().map((rail) => ({ id: rail.id, name: rail.name, network: rail.network }))}
        initialSlug={tools.find((tool) => tool.slug === requested)?.slug ?? tools[0]?.slug}
      />
    </div>
  );
}
