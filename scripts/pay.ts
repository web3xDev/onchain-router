import "dotenv/config";
import { x402Client } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { ExactHederaScheme } from "@x402/hedera/exact/client";
import { createClientHederaSigner, PrivateKey } from "@x402/hedera";

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

  const client = new x402Client().register("hedera:*", new ExactHederaScheme(signer));
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

  const settlement = response.headers.get("x-payment-response");
  if (settlement) {
    let decoded: unknown = settlement;
    try {
      decoded = JSON.parse(Buffer.from(settlement, "base64").toString("utf8"));
    } catch {
      /* not base64 json, print raw */
    }
    console.log("settled :", JSON.stringify(decoded, null, 2));

    const txId =
      typeof decoded === "object" && decoded !== null
        ? ((decoded as Record<string, unknown>).transactionId ??
           (decoded as Record<string, unknown>).transaction)
        : undefined;

    if (typeof txId === "string") {
      console.log(`hashscan: https://hashscan.io/testnet/transaction/${txId}`);
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
