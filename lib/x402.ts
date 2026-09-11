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

// BatchFacilitatorClient defaults to https://gateway-api.circle.com, which is
// mainnet. Left alone on a testnet build it reports no support for Arc testnet and
// route configuration fails with "Facilitator does not support scheme exact on
// network eip155:5042002", an error that says nothing about being pointed at the
// wrong environment.
export const CIRCLE_TESTNET_GATEWAY_URL = "https://gateway-api-testnet.circle.com";

const hederaFacilitator = new HTTPFacilitatorClient({
  url: process.env.X402_FACILITATOR_URL ?? HEDERA_FACILITATOR_URL,
});

// `@circle-fin/x402-batching` ships type definitions with an older copy of
// @x402/core inlined, so its FacilitatorClient is structurally incompatible with the
// installed one (`resource.description` is optional here, required there). Only one
// @x402/core is actually installed, so this is a declaration mismatch, not a runtime
// one, so it is asserted rather than worked around.
const circleFacilitator = new BatchFacilitatorClient({
  url: process.env.CIRCLE_GATEWAY_URL ?? CIRCLE_TESTNET_GATEWAY_URL,
}) as unknown as FacilitatorClient;

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

/** Where a tool's revenue lands, per rail. Mirrors the registry's Payout type. */
export type Payout = { hedera?: string; arc?: string };

/** The router's own receiving addresses, used for tools that name no payout. */
export function routerPayout(): Payout {
  return {
    hedera: required("HEDERA_SERVICE_ACCOUNT_ID"),
    arc: process.env.ARC_SERVICE_ADDRESS || undefined,
  };
}

/** A tool's payout with the router's addresses filling any rail it left out. */
export function resolvePayout(payout?: Payout): Payout {
  const own = routerPayout();
  return { hedera: payout?.hedera ?? own.hedera, arc: payout?.arc ?? own.arc };
}

/**
 * Payment options offered on a paid route.
 *
 * `payout` may be fixed, for a single tool, or a resolver from the request path, for
 * one handler serving many tools. Either way the address in the 402 is the tool
 * author's: settlement goes straight to them and the router keeps no cut.
 *
 * Arc is only advertised once a receiving address exists, so the Hedera rail keeps
 * working on its own while Arc is still being set up.
 */
export function paymentOptions(
  payout?: Payout | ((path: string) => Payout | undefined),
): PaymentOption[] {
  const fixed = typeof payout === "function" ? undefined : resolvePayout(payout);
  const resolve = typeof payout === "function" ? payout : undefined;

  const payToFor = (rail: keyof Payout): PaymentOption["payTo"] =>
    resolve
      ? (context) => resolvePayout(resolve(context.path))[rail] ?? ""
      : (fixed![rail] ?? "");

  const options: PaymentOption[] = [
    {
      scheme: "exact",
      network: HEDERA_NETWORK,
      payTo: payToFor("hedera"),
      price: hederaPrice(),
    },
  ];

  if (routerPayout().arc) {
    options.push({
      scheme: "exact",
      network: ARC_NETWORK,
      payTo: payToFor("arc"),
      price: arcPrice(),
    });
  }

  return options;
}

export type Rail = {
  id: string;
  name: string;
  network: string;
  asset: string;
  amount: string;
  payTo: string;
  settlement: string;
  /** For display: "0.1 HBAR", "$0.01". */
  priceLabel: string;
  assetLabel: string;
  gas: string;
  facilitator: string;
};

/**
 * The rails as the site describes them, read off the same payment options the
 * server actually advertises. A rail that is not configured cannot be shown as
 * live, because there is nothing to read it from.
 */
export function rails(): Rail[] {
  // The site is readable even where the payment env is not set, e.g. a build step or
  // a fork someone cloned. An unconfigured rail is simply not shown as live.
  let options: PaymentOption[];
  try {
    options = paymentOptions(routerPayout());
  } catch {
    return [];
  }

  return options.map((option) => {
    const price = option.price as { asset?: string; amount?: string } | string;
    const asset = typeof price === "string" ? price : (price.asset ?? "");
    const amount = typeof price === "string" ? price : (price.amount ?? "");

    const trim = (n: number, digits: number) =>
      n.toFixed(digits).replace(/\.?0+$/, "");

    return option.network === HEDERA_NETWORK
      ? {
          id: "hedera",
          name: "Hedera testnet",
          network: option.network,
          asset: `HBAR (${asset})`,
          amount: `${amount} tinybar`,
          payTo: String(option.payTo),
          settlement: "Blocky402 facilitator, which also sponsors the gas",
          // 8 decimals.
          priceLabel: `${trim(Number(amount) / 1e8, 4)} HBAR`,
          assetLabel: "HBAR",
          gas: "Gas sponsored",
          facilitator: "Blocky402",
        }
      : {
          id: "arc",
          name: "Arc testnet",
          network: option.network,
          asset: `USDC (${asset})`,
          amount: `${amount} (6 decimals)`,
          payTo: String(option.payTo),
          settlement: "Circle Gateway, gasless from a deposited balance",
          // 6 decimals.
          priceLabel: `${trim(Number(amount) / 1e6, 4)} USDC`,
          assetLabel: "USDC",
          gas: "Gasless",
          facilitator: "Circle Gateway",
        };
  });
}
