import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createPaymentWrapper } from "@x402/mcp";
import type { PaymentRequirements, PaymentPayload } from "@x402/core/types";
import type { ResourceConfig } from "@x402/core/server";
import { paymentOptions, resourceServer } from "@/lib/x402";
import { TOOLS } from "@/lib/tools/registry";
import { SITE_NAME } from "@/lib/site";

/**
 * The router as a remote MCP server.
 *
 * One URL, every tool, priced per call. An x402-aware MCP client calls a tool, gets a
 * payment-required error carrying the accepted rails, signs with its own wallet, and
 * calls again with the payment in `_meta`. The wallet is the caller's; this process
 * never holds one.
 *
 * It is a peer of the HTTP API rather than a proxy for it. Both read the registry and
 * both are gated by the same resource server, so the price and the accepted networks
 * cannot differ between the two ways in.
 */

const MCP_PAYMENT_META_KEY = "x402/payment";

let acceptsPromise: Promise<PaymentRequirements[]> | null = null;

/**
 * The payment requirements every tool advertises, built once per process.
 *
 * `buildPaymentRequirements` needs the facilitators' supported kinds, which is a
 * network round trip, so the result is cached rather than rebuilt per request.
 */
function accepts(): Promise<PaymentRequirements[]> {
  if (!acceptsPromise) {
    acceptsPromise = (async () => {
      await resourceServer.initialize();
      const built = await Promise.all(
        paymentOptions().map((option) =>
          resourceServer.buildPaymentRequirements(option as ResourceConfig),
        ),
      );
      return built.flat();
    })();
  }
  return acceptsPromise;
}

/**
 * Accepts a payment passed as a plain `payment` argument too.
 *
 * The protocol puts the payment in `_meta`, which an SDK-built client sets and a chat
 * client cannot. A client that got the payment from elsewhere, a wallet MCP for
 * example, can hand it over as a base64 argument instead and it is moved into `_meta`
 * before the gate looks. Same receipt, two places to carry it.
 */
function liftPaymentArgument(
  args: Record<string, unknown>,
  extra: unknown,
): { args: Record<string, unknown>; extra: unknown } {
  const { payment, ...rest } = args;
  if (typeof payment !== "string" || payment.length === 0) return { args: rest, extra };

  let payload: PaymentPayload;
  try {
    payload = JSON.parse(Buffer.from(payment, "base64").toString("utf8")) as PaymentPayload;
  } catch {
    return { args: rest, extra };
  }

  const current = (extra ?? {}) as { _meta?: Record<string, unknown> };
  return {
    args: rest,
    extra: { ...current, _meta: { ...current._meta, [MCP_PAYMENT_META_KEY]: payload } },
  };
}

export async function buildRemoteServer(): Promise<McpServer> {
  const requirements = await accepts();
  const server = new McpServer({ name: SITE_NAME.toLowerCase().replace(/\s+/g, "-"), version: "0.1.0" });

  for (const tool of TOOLS) {
    const name = tool.slug.replace(/-/g, "_");

    const gated = createPaymentWrapper(resourceServer, {
      accepts: requirements,
      resource: {
        // The wrapper derives the tool name from this prefix; keep its convention.
        url: `mcp://tool/${name}`,
        description: tool.summary,
        mimeType: "application/json",
        serviceName: SITE_NAME,
      },
    })(async (input: Record<string, unknown>) => {
      try {
        const result = await tool.run(input);
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: error instanceof Error ? error.message : "Tool failed",
            },
          ],
          isError: true,
        };
      }
    });

    server.registerTool(
      name,
      {
        title: tool.summary,
        description: `${tool.description} Covers ${tool.coverage}. Costs ${tool.price} per call, paid with x402 from the caller's own wallet.`,
        inputSchema: {
          ...tool.inputSchema,
          payment: z
            .string()
            .optional()
            .describe("x402 payment payload, base64, if not carried in _meta"),
        },
      },
      async (args: Record<string, unknown>, extra: unknown) => {
        const lifted = liftPaymentArgument(args, extra);
        return gated(lifted.args, lifted.extra);
      },
    );
  }

  return server;
}
