import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { relay, decodeBase64Json } from "@/lib/relay";
import { ARC_NETWORK, HEDERA_NETWORK } from "@/lib/x402";

const ROUTER_NETWORKS = new Set<string>([HEDERA_NETWORK, ARC_NETWORK]);

/**
 * Checks that a URL is an x402 endpoint before it is listed.
 *
 * Sends an unpaid request and reads the 402 back: price, rails, payout address,
 * description. That is everything the catalogue needs, straight from the source,
 * and it is also the test that the endpoint speaks the protocol at all.
 */

const schema = z.object({
  url: z.string().url(),
  /** A sample request body, for endpoints that validate input before quoting. */
  input: z.record(z.string(), z.unknown()).optional(),
});

/** Only public hosts, so this cannot be used to reach into the network it runs on. */
function publicHost(url: URL): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  if (url.protocol !== "https:") return false;
  const host = url.hostname;
  return !(
    host === "localhost" ||
    host.endsWith(".local") ||
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === "::1" ||
    host.startsWith("fc") ||
    host.startsWith("fd")
  );
}

type Accept = { network?: string; amount?: string; asset?: string; payTo?: string };
type Required = { accepts?: Accept[]; resource?: { description?: string } };

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Not a URL." }, { status: 400 });

  const url = new URL(parsed.data.url);
  if (!publicHost(url)) {
    return NextResponse.json({ ok: false, error: "Only public https endpoints can be listed." }, { status: 400 });
  }

  let relayed;
  try {
    relayed = await relay(url.toString(), parsed.data.input ?? {}, undefined, 12);
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Unreachable",
    });
  }

  if (relayed.status !== 402) {
    return NextResponse.json({
      ok: false,
      error:
        relayed.status === 400
          ? "The endpoint rejected the sample request (400). Check the example request matches its inputs."
          : `Expected 402 Payment Required, got ${relayed.status}. This does not look like an x402 endpoint.`,
    });
  }

  const required =
    decodeBase64Json<Required>(relayed.paymentRequired) ?? (relayed.body as Required | null);
  const accepts = required?.accepts ?? [];

  if (accepts.length === 0) {
    return NextResponse.json({ ok: false, error: "402 received, but it lists no payment options." });
  }

  // The router pays on two rails, and everything around it (the wallet MCP, the
  // playground, the catalogue) assumes those two. An endpoint that only takes
  // another network would be listed but unpayable here, so it is not listed.
  const onRails = accepts.filter((a) => a.network && ROUTER_NETWORKS.has(a.network));
  if (onRails.length === 0) {
    const offered = [...new Set(accepts.map((a) => a.network ?? "unknown"))].join(", ");
    return NextResponse.json({
      ok: false,
      error: `Speaks x402, but only on ${offered}. OnchainRouter pays on Hedera (${HEDERA_NETWORK}) and Arc (${ARC_NETWORK}). Add one of those to the 402 and check again.`,
    });
  }

  return NextResponse.json({
    ok: true,
    description: required?.resource?.description ?? null,
    accepts: onRails.map((a) => ({
      network: a.network ?? null,
      amount: a.amount ?? null,
      asset: a.asset ?? null,
      payTo: a.payTo ?? null,
    })),
  });
}
