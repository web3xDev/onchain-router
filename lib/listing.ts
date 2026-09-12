import { relay, decodeBase64Json } from "@/lib/relay";
import { ARC_NETWORK, HEDERA_NETWORK } from "@/lib/x402";

/**
 * Listing a tool, as one piece of logic the site form, the HTTP endpoint and the MCP
 * tool all share.
 *
 * Two halves. `probeEndpoint` sends one unpaid request and reads the 402 back: that
 * is the proof the endpoint speaks x402 and the source of its price, rails and
 * payout. `buildListing` turns a passing probe plus a description into the two
 * artefacts a listing is made of: a prefilled GitHub issue, and the registry line a
 * pull request would add. Nothing is stored here; review happens in the open.
 */

export const REPO = "https://github.com/web3xDev/onchain-router";

const ROUTER_NETWORKS = new Set<string>([HEDERA_NETWORK, ARC_NETWORK]);

export type Accept = { network: string | null; amount: string | null; asset: string | null; payTo: string | null };

export type ProbeResult =
  | { ok: true; description: string | null; accepts: Accept[] }
  | { ok: false; error: string };

type RawAccept = { network?: string; amount?: string; asset?: string; payTo?: string };
type Required = { accepts?: RawAccept[]; resource?: { description?: string } };

/** Only public hosts in production, so this cannot reach into the network it runs on. */
export function publicHost(url: URL): boolean {
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

export async function probeEndpoint(rawUrl: string, input: Record<string, unknown> = {}): Promise<ProbeResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, error: "Not a URL." };
  }
  if (!publicHost(url)) return { ok: false, error: "Only public https endpoints can be listed." };

  let relayed;
  try {
    relayed = await relay(url.toString(), input, undefined, 12);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unreachable" };
  }

  if (relayed.status !== 402) {
    return {
      ok: false,
      error:
        relayed.status === 400
          ? "The endpoint rejected the sample request (400). Check the example request matches its inputs."
          : `Expected 402 Payment Required, got ${relayed.status}. This does not look like an x402 endpoint.`,
    };
  }

  const required = decodeBase64Json<Required>(relayed.paymentRequired) ?? (relayed.body as Required | null);
  const accepts = required?.accepts ?? [];
  if (accepts.length === 0) return { ok: false, error: "402 received, but it lists no payment options." };

  // The router pays on two rails, and everything around it (the wallet MCP, the
  // playground, the catalogue) assumes those two. An endpoint that only takes
  // another network would be listed but unpayable here, so it is not listed.
  const onRails = accepts.filter((a) => a.network && ROUTER_NETWORKS.has(a.network));
  if (onRails.length === 0) {
    const offered = [...new Set(accepts.map((a) => a.network ?? "unknown"))].join(", ");
    return {
      ok: false,
      error: `Speaks x402, but only on ${offered}. OnchainRouter pays on Hedera (${HEDERA_NETWORK}) and Arc (${ARC_NETWORK}). Add one of those to the 402 and check again.`,
    };
  }

  return {
    ok: true,
    description: required?.resource?.description ?? null,
    accepts: onRails.map((a) => ({
      network: a.network ?? null,
      amount: a.amount ?? null,
      asset: a.asset ?? null,
      payTo: a.payTo ?? null,
    })),
  };
}

export type ListingInput = {
  endpoint: string;
  name: string;
  question: string;
  example?: Record<string, unknown>;
  category?: string;
  inputs?: string;
  contact?: string;
};

export type Listing = {
  accepts: Accept[];
  description: string | null;
  issueTitle: string;
  issueBody: string;
  issueUrl: string;
  /** The registry entry a pull request would add to lib/tools/registry.ts. */
  registryEntry: string;
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "tool";

export function buildListing(input: ListingInput, probe: Extract<ProbeResult, { ok: true }>): Listing {
  const example = input.example ?? {};
  const rails = probe.accepts.map((a) => `- ${a.network}: ${a.amount} of ${a.asset} to ${a.payTo}`).join("\n");

  const issueBody = [
    `**Endpoint**: ${input.endpoint.trim()}`,
    "",
    "**402 as read by the router**",
    rails,
    "",
    `**Name**: ${input.name}`,
    `**Category**: ${input.category || "(new category)"}`,
    "",
    "**What it answers**",
    input.question,
    "",
    "**Inputs**",
    input.inputs || "(as in the example request)",
    "",
    "**Example request**",
    "```json",
    JSON.stringify(example, null, 2),
    "```",
    "",
    `**Contact**: ${input.contact || "not stated"}`,
  ].join("\n");

  const issueTitle = `List: ${input.name}`;
  const issueUrl = `${REPO}/issues/new?title=${encodeURIComponent(issueTitle)}&body=${encodeURIComponent(issueBody)}`;

  const payTo = Object.fromEntries(
    probe.accepts.map((a) => [a.network === HEDERA_NETWORK ? "hedera" : "arc", a.payTo]),
  );

  const priceLabel = probe.accepts
    .map((a) =>
      a.network === HEDERA_NETWORK
        ? `${Number(a.amount) / 1e8} HBAR`
        : `${Number(a.amount) / 1e6} USDC`,
    )
    .join(" / ");

  const inputSchema = Object.keys(example)
    .map((key) => `    ${JSON.stringify(key)}: z.string().describe(${JSON.stringify(key)}),`)
    .join("\n");

  const registryEntry = `external({
  slug: ${JSON.stringify(slugify(input.name))},
  name: ${JSON.stringify(input.name)},
  category: ${JSON.stringify(input.category || "other")},
  author: ${JSON.stringify(input.contact || "unknown")},
  payTo: ${JSON.stringify(payTo)},
  summary: ${JSON.stringify(input.question)},
  description: ${JSON.stringify(probe.description ?? input.question)},
  price: ${JSON.stringify(priceLabel)},
  coverage: "listed endpoint",
  endpoint: ${JSON.stringify(input.endpoint.trim())},
  inputSchema: {
${inputSchema}
  },
  example: { request: ${JSON.stringify(example)}, answer: "" },
})`;

  return { accepts: probe.accepts, description: probe.description, issueTitle, issueBody, issueUrl, registryEntry };
}
