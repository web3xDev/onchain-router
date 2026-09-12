import {
  HTTPFacilitatorClient,
  x402ResourceServer,
  x402HTTPResourceServer,
  FacilitatorResponseError,
  type FacilitatorClient,
  type HTTPAdapter,
  type HTTPRequestContext,
} from "@x402/core/server";
import type { PaymentOption } from "@x402/core/http";
import { ExactHederaScheme } from "@x402/hedera/exact/server";
import { BatchFacilitatorClient, GatewayEvmScheme } from "@circle-fin/x402-batching/server";
import {
  ARC_NETWORK,
  ARC_USDC,
  ARC_USDC_DECIMALS,
  CIRCLE_GATEWAY_URL,
  HBAR_ASSET,
  HBAR_DECIMALS,
  HEDERA_FACILITATOR_URL,
  HEDERA_NETWORK,
  toAtomic,
} from "./rails.js";

/**
 * Puts an x402 paywall in front of a function, on Hedera and Arc.
 *
 * The wrapped handler is a plain web-standard `(Request) => Response`, so it drops
 * into a Next.js route, Hono, Bun, Deno, Cloudflare Workers, or anything that speaks
 * fetch. Express and friends can adapt a Request in two lines.
 *
 * The rules match the router's own tools:
 *   - an unpaid call gets a 402 naming the price, the rails and your address;
 *   - a paid call runs the handler, and settles only on a 2xx;
 *   - returning null means "no answer": the caller gets a 404 and is not charged;
 *   - a thrown error is a 502 and is not charged either.
 *
 * Nothing here holds funds. Settlement goes from the caller's wallet to `payTo`.
 */

export type PaidConfig = {
  /** Price per call. Set the rails you want to offer; the other is left out. */
  price: { hbar?: string | number; usdc?: string | number };
  /** Where the money lands. A rail without an address is not offered. */
  payTo: { hedera?: string; arc?: string };
  /** Shown to the caller in the 402. */
  description?: string;
  /** Validates the JSON body before the paywall; throw to reject with a 400. */
  parse?: (body: unknown) => unknown;
  /** Override the facilitators, e.g. for a self-hosted one. */
  facilitators?: { hedera?: string; arc?: string };
};

export type PaidHandler<In = Record<string, unknown>, Out = unknown> = (
  input: In,
  request: Request,
) => Promise<Out | null> | Out | null;

class FetchAdapter implements HTTPAdapter {
  private url: URL;
  constructor(private request: Request, private body: unknown) {
    this.url = new URL(request.url);
  }
  getHeader(name: string) {
    return this.request.headers.get(name) ?? undefined;
  }
  getMethod() {
    return this.request.method;
  }
  getPath() {
    return this.url.pathname;
  }
  getUrl() {
    return this.request.url;
  }
  getAcceptHeader() {
    return this.request.headers.get("Accept") ?? "";
  }
  getUserAgent() {
    return this.request.headers.get("User-Agent") ?? "";
  }
  getQueryParams() {
    const params: Record<string, string | string[]> = {};
    this.url.searchParams.forEach((value, key) => {
      const existing = params[key];
      if (existing === undefined) params[key] = value;
      else if (Array.isArray(existing)) existing.push(value);
      else params[key] = [existing, value];
    });
    return params;
  }
  getQueryParam(name: string) {
    const all = this.url.searchParams.getAll(name);
    if (all.length === 0) return undefined;
    return all.length === 1 ? all[0] : all;
  }
  async getBody() {
    return this.body;
  }
}

function headersToRecord(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

function json(body: unknown, status: number, headers?: HeadersInit): Response {
  const h = new Headers(headers);
  h.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), { status, headers: h });
}

/** The resource server both rails settle through. Built once per `paid()` call. */
export function createResourceServer(facilitators: PaidConfig["facilitators"] = {}) {
  const hedera = new HTTPFacilitatorClient({
    url: facilitators.hedera ?? HEDERA_FACILITATOR_URL,
  });
  // Circle's package inlines an older @x402/core in its types; only one copy runs,
  // so the mismatch is declaration-only.
  const circle = new BatchFacilitatorClient({
    url: facilitators.arc ?? CIRCLE_GATEWAY_URL,
  }) as unknown as FacilitatorClient;

  return new x402ResourceServer([hedera, circle])
    .register("hedera:*", new ExactHederaScheme({}))
    .register("eip155:*", new GatewayEvmScheme());
}

export function paymentOptions(config: Pick<PaidConfig, "price" | "payTo">): PaymentOption[] {
  const options: PaymentOption[] = [];

  if (config.price.hbar !== undefined && config.payTo.hedera) {
    options.push({
      scheme: "exact",
      network: HEDERA_NETWORK,
      payTo: config.payTo.hedera,
      price: { asset: HBAR_ASSET, amount: toAtomic(config.price.hbar, HBAR_DECIMALS) },
    });
  }

  if (config.price.usdc !== undefined && config.payTo.arc) {
    options.push({
      scheme: "exact",
      network: ARC_NETWORK,
      payTo: config.payTo.arc,
      price: { asset: ARC_USDC, amount: toAtomic(config.price.usdc, ARC_USDC_DECIMALS) },
    });
  }

  if (options.length === 0) {
    throw new Error(
      "paid(): nothing to offer. Set price.hbar with payTo.hedera, price.usdc with payTo.arc, or both.",
    );
  }

  return options;
}

export function paid<In = Record<string, unknown>, Out = unknown>(
  config: PaidConfig,
  handler: PaidHandler<In, Out>,
): (request: Request) => Promise<Response> {
  const accepts = paymentOptions(config);
  const server = createResourceServer(config.facilitators);
  const http = new x402HTTPResourceServer(server, {
    accepts,
    description: config.description ?? "Paid over x402",
  });

  // Facilitator capabilities are fetched once, lazily, so importing the module
  // never makes a network call.
  let ready: Promise<void> | null = null;
  const init = () => (ready ??= http.initialize().catch((e) => { ready = null; throw e; }));

  return async (request: Request): Promise<Response> => {
    let body: unknown = {};
    if (request.method !== "GET" && request.method !== "HEAD") {
      try {
        body = await request.clone().json();
      } catch {
        body = {};
      }
    }

    // Free answers first: a malformed call never sees a price.
    let input: In;
    try {
      input = (config.parse ? config.parse(body) : body) as In;
    } catch (error) {
      return json(
        { error: "Invalid input", detail: error instanceof Error ? error.message : String(error) },
        400,
      );
    }

    try {
      await init();
    } catch (error) {
      return json({ error: `Facilitator unreachable: ${(error as Error).message}` }, 502);
    }

    const adapter = new FetchAdapter(request, body);
    const context: HTTPRequestContext = {
      adapter,
      path: adapter.getPath(),
      method: request.method,
      paymentHeader: adapter.getHeader("payment-signature") ?? adapter.getHeader("x-payment"),
    };

    let gate;
    try {
      gate = await http.processHTTPRequest(context);
    } catch (error) {
      if (error instanceof FacilitatorResponseError) return json({ error: error.message }, 502);
      throw error;
    }

    if (gate.type === "payment-error") {
      const headers = new Headers(gate.response.headers);
      return gate.response.isHtml
        ? new Response(gate.response.body as string, { status: gate.response.status, headers })
        : json(gate.response.body ?? {}, gate.response.status, headers);
    }

    // Run the handler. Anything but a 2xx below is never settled.
    let response: Response;
    try {
      const result = await handler(input, request);
      response =
        result === null || result === undefined
          ? json({ answer: null, reason: "No answer for this input", charged: false }, 404)
          : json(result, 200);
    } catch (error) {
      response = json(
        { error: error instanceof Error ? error.message : "Handler failed", charged: false },
        502,
      );
    }

    if (gate.type !== "payment-verified") return response;

    if (response.status >= 400) {
      await gate.cancellationDispatcher.cancel({
        reason: "handler_failed",
        responseStatus: response.status,
      });
      return response;
    }

    const settled = await http.processSettlement(
      gate.paymentPayload,
      gate.paymentRequirements,
      gate.declaredExtensions,
      {
        request: context,
        responseBody: Buffer.from(await response.clone().arrayBuffer()),
        responseHeaders: headersToRecord(response.headers),
      },
      undefined,
      gate.beforeHandlerSettlement,
    );

    if (!settled.success) {
      const r = settled.response;
      return r.isHtml
        ? new Response(r.body as string, { status: r.status, headers: r.headers })
        : json(r.body ?? {}, r.status, r.headers);
    }

    const headers = new Headers(response.headers);
    for (const [k, v] of Object.entries(settled.headers)) headers.set(k, v);
    headers.set("Cache-Control", "private, no-store");
    return new Response(response.body, { status: response.status, headers });
  };
}

export { HEDERA_NETWORK, ARC_NETWORK } from "./rails.js";
