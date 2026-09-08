import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { paymentOptions, resourceServer } from "@/lib/x402";
import { governancePower } from "@/lib/tools/governance-power";
import { GOVERNANCE_PROTOCOLS } from "@/lib/graph/deployments";

/**
 * Who controls a protocol, measured against its own quorum. Live governance data
 * from The Graph, one standardized query, no per-protocol code.
 */
const handler = async (request: NextRequest): Promise<NextResponse<unknown>> => {
  let body: { protocol?: string };
  try {
    body = (await request.json()) as { protocol?: string };
  } catch {
    body = {};
  }

  const protocol = body.protocol ?? "uniswap";

  try {
    return NextResponse.json(await governancePower(protocol));
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Tool failed",
        known: GOVERNANCE_PROTOCOLS,
      },
      { status: 400 },
    );
  }
};

export const POST = withX402(
  handler,
  {
    "/api/tools/governance-power": {
      accepts: paymentOptions(),
      description: "How concentrated a protocol's voting power is, and how much of it never votes",
    },
  },
  resourceServer,
);
