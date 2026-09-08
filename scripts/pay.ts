import dotenv from "dotenv";
import { x402Client } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { ExactHederaScheme } from "@x402/hedera/exact/client";
import { createClientHederaSigner, HBAR_ASSET_ID, PrivateKey } from "@x402/hedera";
import { registerBatchScheme } from "@circle-fin/x402-batching/client";
import { privateKeyToAccount } from "viem/accounts";
import { circleAgentWalletFromEnv } from "@/lib/wallets/circle-agent-wallet";
import type { PaymentRequirements } from "@x402/core/types";

// Next.js reads .env.local; plain `dotenv/config` does not. Load it explicitly,
// then fall back to .env so both layouts work.
dotenv.config({ path: ".env.local" });
dotenv.config();

/**
 * Acts as the paying agent.
 *
 * Registers both rails on one client, calls the tool, and lets the SDK handle
 * 402 -> sign -> pay -> retry. Set PAY_NETWORK to force a rail; otherwise the
 * first advertised option wins.
 *
 * The raw keys here are deliberate: this is a smoke test for the payment rail,
 * not the architecture. Real agents carry a wallet managed by a wallet kit.
 */

const TOOL_URL = process.env.TOOL_URL ?? "http://localhost:3000/api/tools/lending-rates";
const TOOL_BODY = process.env.TOOL_BODY ?? '{"asset":"USDC","chain":"ethereum"}';
const HEDERA_NETWORK = "hedera:testnet";
const ARC_NETWORK = "eip155:5042002";
const ARC_USDC = "0x3600000000000000000000000000000000000000";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. Copy .env.example to .env.local and fill it in.`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const preferred = process.env.PAY_NETWORK;

  // Pick the requested rail when one is named, otherwise take what the server offers first.
  const selector = (_version: number, requirements: PaymentRequirements[]) => {
    if (!preferred) return requirements[0];
    const match = requirements.find((r) => r.network === preferred);
    if (!match) {
      console.error(`Server did not offer ${preferred}. Offered: ${requirements.map((r) => r.network).join(", ")}`);
      process.exit(1);
    }
    return match;
  };

  const client = new x402Client(selector);

  let settlement: unknown;
  client.onPaymentResponse(async (ctx) => {
    // The settle response arrives here directly; reading X-PAYMENT-RESPONSE off the
    // Next.js response is unreliable.
    settlement = ctx;
  });

  // Neither native HBAR nor Arc USDC is in the SDK's default asset table, so both are
  // allowlisted explicitly with a per-payment cap. An agent wallet should carry an
  // allowlist, not a blank cheque.
  client.setSpendControls({
    allowedAssets: [
      {
        network: HEDERA_NETWORK,
        asset: HBAR_ASSET_ID,
        maxAmountPerPayment: process.env.AGENT_MAX_TINYBAR ?? "20000000", // 0.2 HBAR
      },
      {
        network: ARC_NETWORK,
        asset: ARC_USDC,
        maxAmountPerPayment: process.env.AGENT_MAX_ARC_USDC ?? "50000", // $0.05
      },
    ],
  });

  // ── Hedera rail ────────────────────────────────────────────────────────────
  const hederaSigner = createClientHederaSigner(
    required("HEDERA_AGENT_ACCOUNT_ID"),
    PrivateKey.fromStringECDSA(required("HEDERA_AGENT_PRIVATE_KEY")),
    { network: HEDERA_NETWORK },
  );
  client.register("hedera:*", new ExactHederaScheme(hederaSigner));

  // ── Arc rail ───────────────────────────────────────────────────────────────
  // A Circle agent wallet is used when one is configured, so the key stays with
  // Circle rather than in this process. A local key is the fallback, and the payment
  // layer cannot tell the difference: both are just a signer.
  const circleWallet = circleAgentWalletFromEnv();
  const arcKey = process.env.ARC_AGENT_PRIVATE_KEY;

  if (circleWallet) {
    registerBatchScheme(client, { signer: circleWallet });
    console.log(`arc     : ${circleWallet.address} (Circle agent wallet)`);
  } else if (arcKey) {
    const account = privateKeyToAccount(arcKey as `0x${string}`);
    registerBatchScheme(client, { signer: account });
    console.log(`arc     : ${account.address} (local key)`);
  }

  const fetchWithPayment = wrapFetchWithPayment(fetch, client);

  console.log(`hedera  : ${process.env.HEDERA_AGENT_ACCOUNT_ID}`);
  console.log(`tool    : ${TOOL_URL}`);
  console.log(`body    : ${TOOL_BODY}`);
  console.log(`rail    : ${preferred ?? "first offered"}`);
  console.log("");

  const response = await fetchWithPayment(TOOL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: TOOL_BODY,
  });

  console.log(`status  : ${response.status}`);

  if (settlement) {
    const settle = (settlement as { settleResponse?: Record<string, unknown> }).settleResponse;
    console.log(`settled : ${settle?.success ? "success" : "failed"}`);
    console.log(`payer   : ${settle?.payer ?? "?"}`);
    console.log(`network : ${settle?.network ?? "?"}`);

    const tx = String(settle?.transaction ?? "");

    // Hedera reports "0.0.7162784@1788793434.486458284"; HashScan wants dashes.
    const hedera = tx.match(/(\d+\.\d+\.\d+)@(\d+)\.(\d+)/);
    if (hedera) {
      const [, account, seconds, nanos] = hedera;
      console.log(`explorer: https://hashscan.io/testnet/transaction/${account}-${seconds}-${nanos}`);
    } else if (tx.startsWith("0x")) {
      console.log(`explorer: https://explorer.testnet.arc.network/tx/${tx}`);
    }
  } else {
    console.log("settled : no settlement reported");
  }

  console.log("body    :", await response.text());

  if (!response.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
