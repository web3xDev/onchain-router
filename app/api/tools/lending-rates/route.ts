import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { paymentOptions, resourceServer } from "@/lib/x402";
import { lendingRates } from "@/lib/tools/lending-rates";
import { SUPPORTED_CHAINS } from "@/lib/graph/deployments";

/**
 * Where to lend or borrow an asset, decided across every indexed lending protocol
 * on a chain. Live data from The Graph, one standardized query, no per-protocol code.
 */
const handler = async (request: NextRequest): Promise<NextResponse<unknown>> => {
  let body: { asset?: string; chain?: string };
  try {
    body = (await request.json()) as { asset?: string; chain?: string };
  } catch {
    body = {};
  }

  const asset = body.asset ?? "USDC";
  const chain = body.chain ?? "ethereum";

  if (!SUPPORTED_CHAINS.includes(chain.toLowerCase())) {
    return NextResponse.json(
      { error: `Unsupported chain "${chain}"`, supported: SUPPORTED_CHAINS },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await lendingRates(asset, chain));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Tool failed" },
      { status: 502 },
    );
  }
};

export const POST = withX402(
  handler,
  {
    "/api/tools/lending-rates": {
      accepts: paymentOptions(),
      description: "Best lending and borrowing rates for an asset, weighed against liquidity depth",
    },
  },
  resourceServer,
);
