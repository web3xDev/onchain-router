import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { ExactHederaScheme } from "@x402/hedera/exact/server";
import { HBAR_ASSET_ID, HEDERA_TESTNET_CAIP2 } from "@x402/hedera";
import { BatchFacilitatorClient, GatewayEvmScheme } from "@circle-fin/x402-batching/server";
import type { FacilitatorClient } from "@x402/core/server";
import type { PaymentOption } from "@x402/core/http";
import type { Price } from "@x402/core/types";

/**
 * Two payment rails, one interface.
 *
 * A paid call advertises both networks in a single 402 response and the agent pays
 * on whichever one it already holds funds on. Tools never learn which rail settled.
 */

// ── Hedera ───────────────────────────────────────────────────────────────────
//
// Blocky402 is the facilitator required here. Verified live against
// https://api.testnet.blocky402.com/supported, which advertises
// { scheme: "exact", network: "hedera:testnet", extra: { feePayer: "0.0.7162784" } }.
//
// Note: Hedera's own PoC defaults testnet to https://x402.org/facilitator instead,
// so copying it verbatim would settle through the wrong facilitator.
export const HEDERA_FACILITATOR_URL = "https://api.testnet.blocky402.com";
export const HEDERA_NETWORK = HEDERA_TESTNET_CAIP2;

// ── Arc ──────────────────────────────────────────────────────────────────────
//
// Arc settles through Circle Gateway, which signs against the GatewayWalletBatched
// domain rather than the token contract. `@x402/evm`'s ExactEvmScheme drops
// `extra.verifyingContract` and would sign the wrong domain; Circle's
// GatewayEvmScheme exists specifically to carry it through.
//
// Payments come from a Gateway Wallet balance the payer deposits once on-chain,
// after which transfers are gasless.
export const ARC_NETWORK = "eip155:5042002";
export const ARC_USDC = "0x3600000000000000000000000000000000000000";

const hederaFacilitator = new HTTPFacilitatorClient({
  url: process.env.X402_FACILITATOR_URL ?? HEDERA_FACILITATOR_URL,
});

// `@circle-fin/x402-batching` ships type definitions with an older copy of
// @x402/core inlined, so its FacilitatorClient is structurally incompatible with the
// installed one (`resource.description` is optional here, required there). Only one
// @x402/core is actually installed, so this is a declaration mismatch, not a runtime
// one — asserted rather than worked around.
const circleFacilitator = new BatchFacilitatorClient() as unknown as FacilitatorClient;

export const resourceServer = new x402ResourceServer([hederaFacilitator, circleFacilitator])
  .register("hedera:*", new ExactHederaScheme({}))
  .register("eip155:*", new GatewayEvmScheme());

/**
 * Hedera price.
 *
 * `hbar` (default) pays in native HBAR, which needs no HTS token association and is
 * therefore the shortest path to a first real payment. `usdc` uses the SDK's default
 * asset table (0.0.429274 on testnet); the receiving account must be associated with
 * that token first or settlement fails with TOKEN_NOT_ASSOCIATED_TO_ACCOUNT.
 */
export function hederaPrice(): Price {
  const mode = (process.env.X402_ASSET ?? "hbar").toLowerCase();

  if (mode === "hbar") {
    // HBAR has 8 decimals. Default 10_000_000 tinybar = 0.1 HBAR.
    return { asset: HBAR_ASSET_ID, amount: process.env.X402_HBAR_TINYBAR ?? "10000000" };
  }

  return (process.env.X402_PRICE ?? "$0.01") as Price;
}

/** Arc price. USDC on Arc has 6 decimals; 10000 = $0.01. */
export function arcPrice(): Price {
  return { asset: ARC_USDC, amount: process.env.X402_ARC_AMOUNT ?? "10000" };
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Copy .env.example to .env.local and fill it in.`);
  }
  return value;
}

/**
 * Payment options offered on every paid route.
 *
 * Arc is only advertised once a receiving address is configured, so the Hedera rail
 * keeps working on its own while Arc is still being set up.
 */
export function paymentOptions(): PaymentOption[] {
  const options: PaymentOption[] = [
    {
      scheme: "exact",
      network: HEDERA_NETWORK,
      payTo: required("HEDERA_SERVICE_ACCOUNT_ID"),
      price: hederaPrice(),
    },
  ];

  const arcPayTo = process.env.ARC_SERVICE_ADDRESS;
  if (arcPayTo) {
    options.push({
      scheme: "exact",
      network: ARC_NETWORK,
      payTo: arcPayTo,
      price: arcPrice(),
    });
  }

  return options;
}
