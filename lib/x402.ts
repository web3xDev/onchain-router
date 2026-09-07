import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { ExactHederaScheme } from "@x402/hedera/exact/server";
import { HBAR_ASSET_ID, HEDERA_TESTNET_CAIP2 } from "@x402/hedera";
import type { Price } from "@x402/core/types";

/**
 * Blocky402 is the facilitator required by the Hedera bounty.
 * Verified live against https://api.testnet.blocky402.com/supported which advertises
 * { scheme: "exact", network: "hedera:testnet", extra: { feePayer: "0.0.7162784" } }.
 *
 * Note: Hedera's own PoC defaults testnet to https://x402.org/facilitator instead,
 * so copying it verbatim would NOT satisfy the "via Blocky402" requirement.
 */
export const DEFAULT_FACILITATOR_URL = "https://api.testnet.blocky402.com";

export const HEDERA_NETWORK = HEDERA_TESTNET_CAIP2;

export const facilitatorClient = new HTTPFacilitatorClient({
  url: process.env.X402_FACILITATOR_URL ?? DEFAULT_FACILITATOR_URL,
});

/** Single resource server. Arc registers here as a second rail on 8 Sept. */
export const resourceServer = new x402ResourceServer(facilitatorClient).register(
  "hedera:*",
  new ExactHederaScheme({}),
);

/**
 * Price for a tool call.
 *
 * `hbar` (default) pays in native HBAR. HBAR needs no HTS token association, so this
 * is the fastest path to a first real on-chain payment.
 *
 * `usdc` uses the SDK's default asset table (0.0.429274 on testnet, 6 decimals).
 * The receiving account MUST be associated with that token first or settlement
 * fails with TOKEN_NOT_ASSOCIATED_TO_ACCOUNT.
 */
export function toolPrice(): Price {
  const mode = (process.env.X402_ASSET ?? "hbar").toLowerCase();

  if (mode === "hbar") {
    // HBAR has 8 decimals. Default 10_000_000 tinybar = 0.1 HBAR.
    return { asset: HBAR_ASSET_ID, amount: process.env.X402_HBAR_TINYBAR ?? "10000000" };
  }

  return (process.env.X402_PRICE ?? "$0.01") as Price;
}

export function serviceAccountId(): string {
  const id = process.env.HEDERA_SERVICE_ACCOUNT_ID;
  if (!id) {
    throw new Error("HEDERA_SERVICE_ACCOUNT_ID is not set. Copy .env.example to .env.local and fill it in.");
  }
  return id;
}
