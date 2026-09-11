import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createPaymentWrapper } from "@x402/mcp";
import type { PaymentRequirements, PaymentPayload } from "@x402/core/types";
import type { ResourceConfig } from "@x402/core/server";
import { paymentOptions, resourceServer } from "@/lib/x402";
import { TOOLS, type Payout } from "@/lib/tools/registry";
import { SITE_NAME } from "@/lib/site";
import { isNoAnswer } from "@/lib/tools/no-answer";
import { relay, decodeBase64Json } from "@/lib/relay";
import { encodePaymentSignatureHeader } from "@x402/core/http";

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

const acceptsCache = new Map<string, Promise<PaymentRequirements[]>>();

/**
 * The payment requirements a tool advertises, built once per tool per process.
 *
 * Each tool pays out to its own author, so the requirements differ per tool.
 * `buildPaymentRequirements` needs the facilitators' supported kinds, which is a
 * network round trip, so the result is cached rather than rebuilt per request.
 */
function acceptsFor(slug: string, payout?: Payout): Promise<PaymentRequirements[]> {
  let cached = acceptsCache.get(slug);
  if (!cached) {
    cached = (async () => {
      await resourceServer.initialize();
      const built = await Promise.all(
        paymentOptions(payout).map((option) =>
          resourceServer.buildPaymentRequirements(option as ResourceConfig),
        ),
      );
      return built.flat();
    })();
    acceptsCache.set(slug, cached);
  }
  return cached;
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

type ToolResult = {
  [key: string]: unknown;
  content: { type: "text"; text: string }[];
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
};

/**
 * Makes a payment-required result readable by a model, not only by an SDK.
 *
 * The x402 client library reads the JSON from `structuredContent` or from the first
 * text item, so both are left exactly as the wrapper produced them. A second text
 * item explains, in words, what the agent should do next: sign with its wallet and
 * call again. A chat client with a wallet MCP beside it can follow that without
 * knowing the protocol.
 */
function explainPaymentRequired(result: ToolResult, toolName: string): ToolResult {
  const accepts = (result.structuredContent as { accepts?: unknown[] } | undefined)?.accepts;
  if (!result.isError || !Array.isArray(accepts)) return result;

  const rails = accepts
    .map((a) => {
      const r = a as { network?: string; amount?: string; asset?: string };
      return `${r.network} (${r.amount} of ${r.asset})`;
    })
    .join(", ");

  return {
    ...result,
    content: [
      ...result.content,
      {
        type: "text" as const,
        text:
          `Payment required, nothing has been charged. This tool costs one call on any of: ${rails}. ` +
          `Sign the JSON above with your wallet (for example the sign_x402_payment tool) and call ` +
          `${toolName} again with the same arguments plus payment: <the signed payment>.`,
      },
    ],
  };
}

/**
 * A listed endpoint over MCP. The endpoint's own 402 is handed to the caller as a
 * payment-required result, in the same shape the router's own tools use, so an
 * x402 MCP client or a wallet MCP handles it identically. The signed payment comes
 * back in `_meta` or as the `payment` argument and is carried to the endpoint as its
 * header. Settlement is the endpoint's.
 */
async function relayTool(
  endpoint: string,
  args: Record<string, unknown>,
  extra: unknown,
  name: string,
): Promise<ToolResult> {
  const lifted = liftPaymentArgument(args, extra);
  const meta = (lifted.extra as { _meta?: Record<string, unknown> } | undefined)?._meta;
  const payload = meta?.[MCP_PAYMENT_META_KEY] as PaymentPayload | undefined;
  const header = payload ? encodePaymentSignatureHeader(payload) : undefined;

  let relayed;
  try {
    relayed = await relay(endpoint, lifted.args, header);
  } catch (error) {
    return {
      content: [{ type: "text", text: `Endpoint unreachable, not charged. ${error instanceof Error ? error.message : String(error)}` }],
      isError: true,
    };
  }

  if (relayed.status === 402) {
    const required = decodeBase64Json<Record<string, unknown>>(relayed.paymentRequired) ??
      (relayed.body as Record<string, unknown>);
    return explainPaymentRequired(
      {
        content: [{ type: "text", text: JSON.stringify(required) }],
        structuredContent: required,
        isError: true,
      },
      name,
    );
  }

  const text = typeof relayed.body === "string" ? relayed.body : JSON.stringify(relayed.body, null, 2);
  const settle = decodeBase64Json<Record<string, unknown>>(relayed.paymentResponse);

  if (relayed.status >= 400) {
    return {
      content: [{ type: "text", text: `${relayed.status === 404 ? "No answer" : "Endpoint failed"}, not charged. ${text}` }],
      isError: true,
    };
  }

  return {
    content: [{ type: "text", text }],
    ...(settle ? { _meta: { "x402/payment-response": settle } } : {}),
  };
}

export async function buildRemoteServer(): Promise<McpServer> {
  const server = new McpServer({ name: SITE_NAME.toLowerCase().replace(/\s+/g, "-"), version: "0.1.0" });

  for (const tool of TOOLS) {
    const name = tool.slug.replace(/-/g, "_");

    if (tool.endpoint) {
      const endpoint = tool.endpoint;
      server.registerTool(
        name,
        {
          title: tool.summary,
          description: `${tool.description} Covers ${tool.coverage}. Costs ${tool.price} per call, paid with x402 from the caller's own wallet, settled by the tool's own endpoint.`,
          inputSchema: {
            ...tool.inputSchema,
            payment: z.string().optional().describe("x402 payment payload, base64, if not carried in _meta"),
          },
        },
        async (args: Record<string, unknown>, extra: unknown) => relayTool(endpoint, args, extra, name),
      );
      continue;
    }

    const requirements = await acceptsFor(tool.slug, tool.payTo);

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
        // isError cancels settlement, so a tool with nothing to say costs nothing.
        const text = isNoAnswer(error)
          ? `No answer, not charged. ${error.message}`
          : `Tool failed, not charged. ${error instanceof Error ? error.message : String(error)}`;
        return { content: [{ type: "text" as const, text }], isError: true };
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
        const result = (await gated(lifted.args, lifted.extra)) as ToolResult;
        return explainPaymentRequired(result, name);
      },
    );
  }

  return server;
}
