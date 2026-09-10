#!/usr/bin/env node
import path from "node:path";
import dotenv from "dotenv";

// Same reason as mcp/server.ts: the client launches this with no environment, and the
// wallet lives in the project's .env.local.
dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { encodePaymentSignatureHeader } from "@x402/core/http";
import type { PaymentRequired } from "@x402/core/types";
import { z } from "zod";
import { paymentClientFromEnv } from "@/lib/payment/agent-wallet";

/**
 * The agent's wallet, as its own MCP server.
 *
 * This is the other half of the remote router. The router at /mcp holds nothing and
 * answers a tool call with "payment required" and the rails it accepts. Something on
 * the agent's side has to sign. For an SDK-built agent that is the x402 client
 * library; for a chat client it is this: one tool that takes the payment request and
 * returns a signed payment the agent passes back to the router.
 *
 * It deliberately knows nothing about the router. It signs x402 payment requests. Any
 * x402 service the agent talks to can be paid through it, which is the point of a
 * wallet being a separate thing from the services it pays.
 */

const wallet = paymentClientFromEnv();

const server = new McpServer({ name: "onchain-wallet", version: "0.1.0" });

server.registerTool(
  "wallet_info",
  {
    title: "What this wallet can pay with",
    description: "Which networks this wallet signs on and which accounts it pays from. Free.",
    inputSchema: {},
  },
  async () => ({
    content: [
      {
        type: "text" as const,
        text: wallet ? wallet.describe : "No wallet configured. Fill in .env.local.",
      },
    ],
  }),
);

server.registerTool(
  "sign_x402_payment",
  {
    title: "Sign an x402 payment request",
    description:
      "Takes the payment-required response an x402 service returned (the JSON with an " +
      "`accepts` list) and returns a signed payment for one of the accepted rails. Pass " +
      "the result back to the service as its `payment` argument, or as the " +
      "PAYMENT-SIGNATURE header over HTTP. Signing commits funds; only call this when " +
      "the user wants the paid tool to run.",
    inputSchema: {
      paymentRequired: z
        .union([z.string(), z.record(z.string(), z.unknown())])
        .describe("The payment-required JSON, as returned by the service, or that JSON as a string"),
      network: z
        .string()
        .optional()
        .describe("Prefer this network if the service offers it, e.g. hedera:testnet or eip155:5042002"),
    },
  },
  async ({ paymentRequired, network }) => {
    if (!wallet) {
      return {
        content: [{ type: "text" as const, text: "No wallet configured. Fill in .env.local." }],
        isError: true,
      };
    }

    let required: PaymentRequired;
    try {
      required = (
        typeof paymentRequired === "string" ? JSON.parse(paymentRequired) : paymentRequired
      ) as PaymentRequired;
    } catch {
      return {
        content: [{ type: "text" as const, text: "paymentRequired is not valid JSON." }],
        isError: true,
      };
    }

    if (!Array.isArray(required.accepts) || required.accepts.length === 0) {
      return {
        content: [{ type: "text" as const, text: "paymentRequired has no `accepts` list." }],
        isError: true,
      };
    }

    // A preferred network narrows the list; the client's own selector then picks
    // from what is left, so an unavailable preference falls back rather than failing.
    const narrowed = network
      ? { ...required, accepts: required.accepts.filter((a) => a.network === network) }
      : required;
    const candidate = narrowed.accepts.length > 0 ? narrowed : required;

    try {
      const payload = await wallet.client.createPaymentPayload(candidate);
      const chosen = payload.accepted;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                payment: encodePaymentSignatureHeader(payload),
                network: chosen?.network,
                amount: chosen?.amount,
                asset: chosen?.asset,
                payTo: chosen?.payTo,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Could not sign: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

async function main() {
  console.error(wallet ? `onchain-wallet: ${wallet.describe}` : "onchain-wallet: no wallet configured");
  await server.connect(new StdioServerTransport());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
