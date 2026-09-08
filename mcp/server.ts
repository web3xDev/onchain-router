#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

/**
 * Onchain Router MCP server.
 *
 * A catalogue, not a cashier. It tells an agent what onchain capabilities exist,
 * what each costs, and where to pay — then gets out of the way. The agent settles
 * from its own wallet, so no key is configured here and no funds pass through.
 *
 * That separation is deliberate. An agent that spends should spend its own money;
 * a router that holds the money would be an intermediary nobody asked for.
 */

const ROUTER_URL = process.env.ONCHAIN_ROUTER_URL ?? "http://localhost:3000";

type PaymentOption = {
  scheme: string;
  network: string;
  asset: string;
  amount: string;
  payTo: string;
};

type Quote = {
  url: string;
  accepts: PaymentOption[];
};

/**
 * Calls a router tool. Returns the result when payment has already been settled,
 * or the price and payment options when it has not.
 */
async function callTool(
  slug: string,
  body: Record<string, unknown>,
  paymentHeader?: string,
): Promise<{ paid: true; data: unknown } | { paid: false; quote: Quote }> {
  const url = `${ROUTER_URL}/api/tools/${slug}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(paymentHeader ? { "X-PAYMENT": paymentHeader } : {}),
    },
    body: JSON.stringify(body),
  });

  if (response.status !== 402) {
    return { paid: true, data: await response.json() };
  }

  const header = response.headers.get("payment-required");
  const accepts: PaymentOption[] = header
    ? (JSON.parse(Buffer.from(header, "base64").toString("utf8")).accepts ?? [])
    : [];

  return { paid: false, quote: { url, accepts } };
}

function renderQuote(quote: Quote): string {
  const options = quote.accepts
    .map((a) => `  • ${a.network} — ${a.amount} of ${a.asset} to ${a.payTo}`)
    .join("\n");

  return [
    `Payment required before this tool returns data.`,
    ``,
    `Endpoint: POST ${quote.url}`,
    `Accepted payment options:`,
    options || "  (none advertised)",
    ``,
    `Settle one of these from your own wallet with x402, then call this tool again`,
    `with the payment receipt, or pay the endpoint directly — for example with an`,
    `agent wallet that speaks x402.`,
  ].join("\n");
}

async function respond(slug: string, body: Record<string, unknown>, payment?: string) {
  try {
    const result = await callTool(slug, body, payment);
    return {
      content: [
        {
          type: "text" as const,
          text: result.paid
            ? JSON.stringify(result.data, null, 2)
            : renderQuote(result.quote),
        },
      ],
      isError: false,
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Router unreachable at ${ROUTER_URL}: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

const server = new McpServer({ name: "onchain-router", version: "0.1.0" });

server.registerTool(
  "lending_rates",
  {
    title: "Lending rates across every indexed protocol",
    description:
      "Where to lend or borrow an asset, decided across every lending protocol indexed on a chain. " +
      "Returns a judgment rather than a table: the best rate weighed against the liquidity behind it, " +
      "and an explanation of any higher rate that was discarded as too thin or stale to trust. " +
      "Costs a fraction of a cent, settled with x402 from the calling agent's own wallet.",
    inputSchema: {
      asset: z.string().describe("Asset symbol, e.g. USDC or WETH"),
      chain: z
        .enum(["ethereum", "arbitrum", "base", "optimism", "polygon", "avalanche"])
        .describe("Chain to search"),
      payment: z.string().optional().describe("x402 payment receipt, if already settled"),
    },
  },
  async ({ asset, chain, payment }) => respond("lending-rates", { asset, chain }, payment),
);

server.registerTool(
  "governance_power",
  {
    title: "How concentrated a protocol's governance is",
    description:
      "Who actually controls a protocol. Measures the delegate table against the protocol's own quorum: " +
      "how few delegates could carry a vote between them, how much of the voting power the top ten hold, " +
      "and how much of it has never voted. " +
      "Costs a fraction of a cent, settled with x402 from the calling agent's own wallet.",
    inputSchema: {
      protocol: z.string().describe("Protocol name, e.g. uniswap, compound, ens, maker"),
      payment: z.string().optional().describe("x402 payment receipt, if already settled"),
    },
  },
  async ({ protocol, payment }) => respond("governance-power", { protocol }, payment),
);

async function main() {
  await server.connect(new StdioServerTransport());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
