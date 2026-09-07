import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { HEDERA_NETWORK, resourceServer, serviceAccountId, toolPrice } from "@/lib/x402";

/**
 * Smoke-test tool. Deliberately returns a constant.
 *
 * Day 1 proves the payment rail, not the data layer: an agent must be able to call
 * this, receive 402, pay on Hedera through Blocky402, and get this body back with a
 * real transaction id. Real Graph-backed tools land from 9 Sept.
 */
const handler = async (_request: NextRequest) => {
  return NextResponse.json({
    ok: true,
    tool: "test",
    message: "Payment settled. This endpoint is x402-gated on Hedera testnet.",
    timestamp: new Date().toISOString(),
  });
};

export const POST = withX402(
  handler,
  {
    "/api/tools/test": {
      accepts: {
        scheme: "exact",
        network: HEDERA_NETWORK,
        payTo: serviceAccountId(),
        price: toolPrice(),
      },
      description: "Onchain Router smoke-test tool",
    },
  },
  resourceServer,
);
