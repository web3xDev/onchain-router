#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { agentWalletFromEnv } from "@/lib/payment/agent-wallet";
import { TOOLS } from "@/lib/tools/registry";

/**
 * Onchain Router MCP server.
 *
 * A catalogue first: it says what onchain capabilities exist and what each costs.
 * Whether it also settles is the operator's choice.
 *
 * With no wallet configured it returns the price and stops, and the calling agent
 * pays from its own wallet — a Circle agent wallet, a Hedera wallet MCP, anything that
 * speaks x402. With a wallet configured it settles in one step, from the wallet whose
 * credentials sit in this server's own config.
 *
 * The money is the caller's either way. The only thing that changes is whose process
 * holds the signing material, which is why the Circle path is preferred where
 * available: the key never reaches this machine at all.
 */

const ROUTER_URL = process.env.ONCHAIN_ROUTER_URL ?? "http://localhost:3000";

/** Configured once at startup; null means quote-only. */
const wallet = agentWalletFromEnv();

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

  // A configured wallet settles the 402 transparently; without one this is plain
  // fetch and the 402 comes back for the caller to handle.
  const send = wallet?.fetch ?? fetch;

  const response = await send(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // v2 reads PAYMENT-SIGNATURE, v1 reads X-PAYMENT. Sending both costs nothing
      // and lets the same receipt work against either.
      ...(paymentHeader
        ? { "PAYMENT-SIGNATURE": paymentHeader, "X-PAYMENT": paymentHeader }
        : {}),
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

// Registered from the same registry the HTTP API and the site catalogue read, so a
// new tool appears in Claude, on the endpoint and in the catalogue from one entry.
for (const tool of TOOLS) {
  server.registerTool(
    tool.slug.replace(/-/g, "_"),
    {
      title: tool.summary,
      description: `${tool.description} Covers ${tool.coverage}. Costs ${tool.price} per call, settled with x402.`,
      inputSchema: {
        ...tool.inputSchema,
        payment: z.string().optional().describe("x402 payment receipt, if already settled"),
      },
    },
    async (args: Record<string, unknown>) => {
      const { payment, ...input } = args;
      return respond(tool.slug, input, payment as string | undefined);
    },
  );
}

async function main() {
  // stderr: stdout is the MCP transport.
  console.error(wallet ? `onchain-router: settling via ${wallet.describe}` : "onchain-router: quote-only, no wallet configured");
  await server.connect(new StdioServerTransport());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
