import dotenv from "dotenv";
import { x402Client } from "@x402/core/client";

// Next.js reads .env.local; plain `dotenv/config` does not. Load it explicitly,
// then fall back to .env so both layouts work.
dotenv.config({ path: ".env.local" });
dotenv.config();

import { wrapFetchWithPayment } from "@x402/fetch";
import { ExactHederaScheme } from "@x402/hedera/exact/client";
import { createClientHederaSigner, HBAR_ASSET_ID, PrivateKey } from "@x402/hedera";

/**
 * Day 1 smoke test: act as the paying agent.
 *
 * Calls the x402-gated tool, lets the SDK handle 402 -> sign -> pay -> retry,
 * then prints the settlement so we can open it on HashScan.
 */

const TOOL_URL = process.env.TOOL_URL ?? "http://localhost:3000/api/tools/test";
const NETWORK = "hedera:testnet";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. Copy .env.example to .env.local and fill it in.`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const accountId = required("HEDERA_AGENT_ACCOUNT_ID");
  const privateKey = required("HEDERA_AGENT_PRIVATE_KEY");

  const signer = createClientHederaSigner(accountId, PrivateKey.fromStringECDSA(privateKey), {
    network: NETWORK,
  });

  // The client only spends "default assets" (USDC here) unless told otherwise.
  // Native HBAR is not in that table, so allow it explicitly with a hard per-payment
  // cap. An agent wallet should carry an allowlist, not a blank cheque.
  let settlement: unknown;

  const client = new x402Client()
    .onPaymentResponse(async (ctx) => {
      // The settle response is delivered here directly. Reading it off the
      // X-PAYMENT-RESPONSE header is unreliable through the Next.js response path.
      settlement = ctx;
    })
    .setSpendControls({
      allowedAssets: [
        {
          network: NETWORK,
          asset: HBAR_ASSET_ID,
          maxAmountPerPayment: process.env.AGENT_MAX_TINYBAR ?? "20000000", // 0.2 HBAR
        },
      ],
    })
    .register("hedera:*", new ExactHederaScheme(signer));

  const fetchWithPayment = wrapFetchWithPayment(fetch, client);

  console.log(`agent   : ${accountId}`);
  console.log(`tool    : ${TOOL_URL}`);
  console.log(`asset   : ${(process.env.X402_ASSET ?? "hbar").toUpperCase()}`);
  console.log("");

  const response = await fetchWithPayment(TOOL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  console.log(`status  : ${response.status}`);

  if (settlement) {
    const settle = (settlement as { settleResponse?: Record<string, unknown> }).settleResponse;
    console.log(`settled : ${settle?.success ? "success" : "failed"}`);
    console.log(`payer   : ${settle?.payer ?? "?"}`);
    console.log(`network : ${settle?.network ?? "?"}`);

    // Settlement reports "0.0.7162784@1788793434.486458284";
    // HashScan wants "0.0.7162784-1788793434-486458284".
    const found = String(settle?.transaction ?? "").match(/(\d+\.\d+\.\d+)@(\d+)\.(\d+)/);
    if (found) {
      const [, account, seconds, nanos] = found;
      console.log(`hashscan: https://hashscan.io/testnet/transaction/${account}-${seconds}-${nanos}`);
    }
  } else {
    console.log("settled : no x-payment-response header returned");
  }

  const body = await response.text();
  console.log("body    :", body);

  if (!response.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
