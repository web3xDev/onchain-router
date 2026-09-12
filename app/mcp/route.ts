import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { buildRemoteServer } from "@/lib/mcp/remote";

/**
 * POST /mcp is the router as one MCP URL.
 *
 * Stateless on purpose: every request gets a fresh server and transport, and
 * nothing is kept between calls. That is what lets this run on a serverless host
 * with no session store, and it is also the honest shape for a service where the
 * only state that matters, the payment, travels inside the call itself.
 */

export const dynamic = "force-dynamic";

async function handle(request: Request): Promise<Response> {
  const server = await buildRemoteServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    // Plain JSON responses rather than an SSE stream. Simpler for clients, and it
    // does not hold a connection open on a host that bills for that.
    enableJsonResponse: true,
  });

  await server.connect(transport);

  try {
    return await transport.handleRequest(request);
  } finally {
    // Closing the server closes the transport with it.
    await server.close();
  }
}

export async function POST(request: Request) {
  return handle(request);
}

/** Streamable HTTP clients may probe with GET; without sessions there is no stream to offer. */
export async function GET() {
  return new Response(
    JSON.stringify({
      name: "onchainrouter",
      transport: "streamable-http",
      hint: "POST JSON-RPC to this URL. Tools are priced per call and paid with x402.",
    }),
    { status: 405, headers: { "Content-Type": "application/json", Allow: "POST" } },
  );
}

export async function DELETE() {
  return new Response(null, { status: 204 });
}
