import { z } from "zod";
import { lendingRates } from "@/lib/tools/lending-rates";
import { governancePower } from "@/lib/tools/governance-power";
import { SUPPORTED_CHAINS } from "@/lib/graph/deployments";
import { LIVE_GOVERNANCE_PROTOCOLS, LIVE_LENDING_TOTAL } from "@/lib/graph/verified";

/**
 * Every tool the router offers, declared once.
 *
 * The HTTP route, the MCP server and the catalogue on the site all read from here,
 * so adding a capability is one entry rather than three edits kept in sync by hand.
 * That matters more than it sounds: a router whose catalogue can drift from what it
 * actually serves is not a catalogue, it is a brochure.
 */

/**
 * Where a tool's revenue lands, per rail.
 *
 * Settlement goes straight from the calling agent to this address. The router takes
 * nothing and holds nothing in between: 0% commission, no invoice, no payout run.
 * A tool without one is the router's own and settles to the router's addresses.
 */
export type Payout = {
  hedera?: string;
  arc?: string;
};

export type ToolDefinition = {
  /** URL segment and MCP tool name stem. */
  slug: string;
  name: string;
  category: string;
  /** Who built it. Shown on the card; the payout goes to them. */
  author: string;
  payTo?: Payout;
  /** One line, for a catalogue card. */
  summary: string;
  /** What question it answers and how, for the detail page and MCP description. */
  description: string;
  /** Price as x402 states it, for display. */
  price: string;
  /** What the tool reaches, in the operator's words. */
  coverage: string;
  inputSchema: z.ZodRawShape;
  /** A real request and the shape of its answer, for the detail page. */
  example: { request: Record<string, unknown>; answer: string };
  run: (input: Record<string, unknown>) => Promise<unknown>;
};

export const TOOLS: ToolDefinition[] = [
  {
    slug: "lending-rates",
    name: "Lending rates",
    category: "lending",
    author: "Onchain Router",
    summary: "Best place to lend or borrow an asset, weighed against liquidity depth.",
    description:
      "Asks every lending protocol indexed on a chain the same standardized question and " +
      "returns a decision rather than a table: the best rate, the liquidity behind it, and " +
      "why any higher rate was discarded as too thin or too stale to trust.",
    price: "$0.01",
    coverage: `${SUPPORTED_CHAINS.length} chains, ${LIVE_LENDING_TOTAL} live deployments`,
    inputSchema: {
      asset: z.string().describe("Asset symbol, e.g. USDC or WETH"),
      chain: z
        .enum(["ethereum", "arbitrum", "base", "optimism", "polygon", "avalanche"])
        .describe("Chain to search"),
    },
    example: {
      request: { asset: "USDC", chain: "ethereum" },
      answer:
        "Best supply rate: 4.86% on compound-v3, backed by $375.4M of liquidity. " +
        "iron-bank reports 75.10%, far outside what every live market on this chain pays. " +
        "Read as stale data from an abandoned protocol, not an offer. " +
        "Next best is aave-v3 at 3.62%, 1.23 points behind.",
    },
    run: (input) => lendingRates(String(input.asset ?? "USDC"), String(input.chain ?? "ethereum")),
  },

  {
    slug: "governance-power",
    name: "Governance power",
    category: "governance",
    author: "Onchain Router",
    summary: "How concentrated a protocol's voting power is, and how much of it never votes.",
    description:
      "Measures a protocol's delegate table against its own on-chain quorum: how few " +
      "delegates could carry a vote between them, how much the ten largest hold, and how " +
      "much of that power has never been used.",
    price: "$0.01",
    coverage: `${LIVE_GOVERNANCE_PROTOCOLS.length} protocols`,
    inputSchema: {
      // Only the protocols the probe found actually serving data. The other seven are
      // listed on the network but return nothing, and offering them would sell a call
      // that cannot answer.
      protocol: z
        .enum([...LIVE_GOVERNANCE_PROTOCOLS] as [string, ...string[]])
        .describe("Protocol whose delegate table to measure"),
    },
    example: {
      request: { protocol: "uniswap" },
      answer:
        "4 delegates acting together reach quorum: concentrated, but not captured by two " +
        "or three. The ten largest delegates hold 53.8% of delegated votes. One of them has " +
        "never cast a vote, holding 5.5% on its own.",
    },
    run: (input) => governancePower(String(input.protocol ?? "uniswap")),
  },
];

export function findTool(slug: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

export type InputField = {
  name: string;
  type: string;
  description: string;
  /** Present when the field only accepts a fixed set of values. */
  options?: string[];
};

/**
 * The input schema as a reader can use it.
 *
 * Read off the same zod shape the endpoint validates against, so the arguments
 * documented on a tool's page are the arguments it will actually accept.
 */
export function describeInputs(tool: ToolDefinition): InputField[] {
  return Object.entries(tool.inputSchema).map(([name, schema]) => {
    const field = schema as z.ZodTypeAny;
    const description = field.description ?? "";

    if (field instanceof z.ZodEnum) {
      const options = Object.values(field.options ?? {}).map(String);
      return { name, type: "enum", description, options };
    }

    if (field instanceof z.ZodNumber) return { name, type: "number", description };
    if (field instanceof z.ZodBoolean) return { name, type: "boolean", description };
    return { name, type: "string", description };
  });
}

export const CATEGORIES = [...new Set(TOOLS.map((t) => t.category))];

/** The catalogue as the site and any client sees it: everything but the code. */
export function catalogue() {
  return TOOLS.map(({ run: _run, inputSchema, ...rest }) => ({
    ...rest,
    inputs: Object.keys(inputSchema),
  }));
}
