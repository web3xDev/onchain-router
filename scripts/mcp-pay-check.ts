import dotenv from "dotenv";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { x402Client } from "@x402/core/client";
import { decodePaymentRequiredHeader, encodePaymentSignatureHeader } from "@x402/core/http";
import { ExactHederaScheme } from "@x402/hedera/exact/client";
import { createClientHederaSigner, HBAR_ASSET_ID, PrivateKey } from "@x402/hedera";

dotenv.config({ path: ".env.local" });
dotenv.config();

/**
 * The full loop an agent with its own wallet would run:
 *
 *   ask over MCP -> get a price -> sign a payment from its own key -> ask again
 *
 * The MCP server never sees the key. It forwards the receipt and returns the data.
 */

const ROUTER_URL = process.env.ONCHAIN_ROUTER_URL ?? "http://localhost:3000";
const HEDERA_NETWORK = "hedera:testnet";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}`);
    process.exit(1);
  }
  return value;
}

/** Acts as the agent's wallet: signs a payment for the quoted requirements. */
async function signPayment(endpoint: string, body: unknown): Promise<string> {
  const signer = createClientHederaSigner(
    required("HEDERA_AGENT_ACCOUNT_ID"),
    PrivateKey.fromStringECDSA(required("HEDERA_AGENT_PRIVATE_KEY")),
    { network: HEDERA_NETWORK },
  );

  const client = new x402Client((_v, reqs) => {
    const hedera = reqs.find((r) => r.network === HEDERA_NETWORK);
    if (!hedera) throw new Error("Hedera not offered");
    return hedera;
  })
    .setSpendControls({
      allowedAssets: [
        { network: HEDERA_NETWORK, asset: HBAR_ASSET_ID, maxAmountPerPayment: "20000000" },
      ],
    })
    .register("hedera:*", new ExactHederaScheme(signer));

  const unpaid = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const header = unpaid.headers.get("payment-required");
  if (!header) throw new Error(`Expected a 402 quote, got ${unpaid.status}`);

  const paymentRequired = decodePaymentRequiredHeader(header);
  const payload = await client.createPaymentPayload(paymentRequired);
  return encodePaymentSignatureHeader(payload);
}

async function main() {
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", "mcp/server.ts"],
    env: { ...process.env, ONCHAIN_ROUTER_URL: ROUTER_URL },
  });

  const client = new Client({ name: "mcp-pay-check", version: "0.1.0" });
  await client.connect(transport);

  const args = { asset: "USDC", chain: "ethereum" };

  console.log("1. asking without payment");
  const quoted = await client.callTool({ name: "lending_rates", arguments: args });
  const quote = (quoted.content as { text?: string }[])[0]?.text ?? "";
  console.log(`   ${quote.split("\n")[0]}`);

  console.log("2. signing from the agent's own wallet");
  const receipt = await signPayment(`${ROUTER_URL}/api/tools/lending-rates`, args);
  console.log(`   receipt: ${receipt.slice(0, 40)}... (${receipt.length} chars)`);

  console.log("3. asking again with the receipt");
  const paid = await client.callTool({
    name: "lending_rates",
    arguments: { ...args, payment: receipt },
  });

  const text = (paid.content as { text?: string }[])[0]?.text ?? "";
  try {
    const data = JSON.parse(text) as { assessment?: string; responded?: number };
    console.log(`   PAID · ${data.responded} protocols answered`);
    console.log("");
    console.log(data.assessment);
  } catch {
    console.log("   still unpaid:");
    console.log(text.split("\n").slice(0, 3).join("\n"));
    process.exit(1);
  }

  await client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
