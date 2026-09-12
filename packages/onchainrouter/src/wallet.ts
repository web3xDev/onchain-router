import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { encodePaymentSignatureHeader } from "@x402/core/http";
import type { PaymentRequired } from "@x402/core/types";
import { z } from "zod";
import { walletFromEnv, type Wallet } from "./client.js";

/**
 * The agent's wallet as an MCP server, for chat clients that cannot sign.
 *
 * A remote x402 service answers a tool call with "payment required" and the rails it
 * accepts. Claude Code, Cursor and the like have no wallet, so this gives them one:
 * a single tool that takes the payment request and returns a signed payment the
 * agent passes back. It knows nothing about any particular service; it signs x402.
 */

const NO_WALLET =
  "No wallet configured. Set HEDERA_AGENT_ACCOUNT_ID and HEDERA_AGENT_PRIVATE_KEY, " +
  "ARC_AGENT_PRIVATE_KEY, or the four CIRCLE_* variables.";

export function createWalletServer(wallet: Wallet | null): McpServer {
  const server = new McpServer({ name: "onchainrouter-wallet", version: "0.1.0" });

  server.registerTool(
    "wallet_info",
    {
      title: "What this wallet can pay with",
      description: "Which networks this wallet signs on and which accounts it pays from. Free.",
      inputSchema: {},
    },
    async () => ({
      content: [{ type: "text" as const, text: wallet ? wallet.describe : NO_WALLET }],
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
          .describe("The payment-required JSON as returned by the service, or that JSON as a string"),
        network: z
          .string()
          .optional()
          .describe("Prefer this network if offered, e.g. hedera:testnet or eip155:5042002"),
      },
    },
    async ({ paymentRequired, network }) => {
      const fail = (text: string) => ({ content: [{ type: "text" as const, text }], isError: true });
      if (!wallet) return fail(NO_WALLET);

      let required: PaymentRequired;
      try {
        required = (
          typeof paymentRequired === "string" ? JSON.parse(paymentRequired) : paymentRequired
        ) as PaymentRequired;
      } catch {
        return fail("paymentRequired is not valid JSON.");
      }
      if (!Array.isArray(required.accepts) || required.accepts.length === 0) {
        return fail("paymentRequired has no `accepts` list.");
      }

      // A preferred network narrows the list; an unavailable preference falls back.
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
        return fail(`Could not sign: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  );

  return server;
}

/** Starts the wallet on stdio, reading keys from the environment. */
export async function serveWallet(): Promise<void> {
  const wallet = walletFromEnv();
  console.error(wallet ? `onchainrouter wallet: ${wallet.describe}` : `onchainrouter wallet: ${NO_WALLET}`);
  await createWalletServer(wallet).connect(new StdioServerTransport());
}
