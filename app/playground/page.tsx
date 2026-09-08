import type { Metadata } from "next";
import { describeInputs, TOOLS } from "@/lib/tools/registry";
import { rails } from "@/lib/x402";
import { Playground } from "@/components/playground";

export const metadata: Metadata = {
  title: "Playground · Onchain Router",
  description:
    "Call a paid onchain tool and watch a real payment settle, without needing a wallet.",
};

export default async function PlaygroundPage({
  searchParams,
}: {
  searchParams: Promise<{ tool?: string }>;
}) {
  const requested = (await searchParams).tool;

  const tools = TOOLS.map((tool) => ({
    slug: tool.slug,
    name: tool.name,
    price: tool.price,
    summary: tool.summary,
    inputs: describeInputs(tool),
    example: tool.example.request,
  }));

  return (
    <div className="page">
      <div className="page-head">
        <span className="label">Playground</span>
        <h1>Watch an agent pay for an answer</h1>
        <p>
          The call below is a real x402 payment on testnet, settled on chain. The only
          difference from your own agent is whose wallet pays: here it is ours, so you can
          try it without funding anything.
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
