import { z } from "zod";
import { lendingRates } from "@/lib/tools/lending-rates";
import { governancePower } from "@/lib/tools/governance-power";
import { withdrawalRisk } from "@/lib/tools/withdrawal-risk";
import { protocolHealth, HEALTH_PROTOCOLS } from "@/lib/tools/protocol-health";
import { governancePulse } from "@/lib/tools/governance-pulse";
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
  /** Where the data comes from, for the card. "graph" gets The Graph's mark. */
  source?: "graph" | string;
  inputSchema: z.ZodRawShape;
  /** A real request and the shape of its answer, for the detail page. */
  example: { request: Record<string, unknown>; answer: string };
  /**
   * An x402 endpoint somewhere else. The router relays: the caller's payment goes
   * to that endpoint's own payTo and settles there. The router verifies nothing and
   * holds nothing; it carries the 402 out and the signed payment back in.
   */
  endpoint?: string;
  run: (input: Record<string, unknown>) => Promise<unknown>;
};

/**
 * Lists an x402 endpoint that already exists. Price and payout come from its own
 * 402 at call time; what is written here is for the catalogue.
 */
export function external(
  tool: Omit<ToolDefinition, "run" | "endpoint"> & { endpoint: string },
): ToolDefinition {
  return {
    ...tool,
    // Never called: relayed tools are handled before run() by both transports.
    run: async () => {
      throw new Error(`${tool.slug} is relayed to ${tool.endpoint}, not run here`);
    },
  };
}

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
    source: "graph",
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
    source: "graph",
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

  {
    slug: "withdrawal-risk",
    name: "Withdrawal risk",
    category: "lending",
    author: "Onchain Router",
    summary: "Whether a deposit can actually leave a lending market right now, and how much can.",
    description:
      "Measures every lending market for an asset by what is not lent out: the free " +
      "liquidity in dollars and the utilisation behind it. Says which markets are open, " +
      "which are tight, and which are effectively locked behind borrowers, and whether a " +
      "withdrawal of a given size would clear today.",
    price: "$0.01",
    coverage: `${SUPPORTED_CHAINS.length} chains, ${LIVE_LENDING_TOTAL} live deployments`,
    source: "graph",
    inputSchema: {
      asset: z.string().describe("Asset symbol, e.g. USDC or WETH"),
      chain: z
        .enum(["ethereum", "arbitrum", "base", "optimism", "polygon", "avalanche"])
        .describe("Chain to search"),
      amountUsd: z
        .number()
        .positive()
        .optional()
        .describe("Withdrawal size in USD, to check whether it clears"),
    },
    example: {
      request: { asset: "USDC", chain: "base", amountUsd: 50000 },
      answer:
        "compound-v3 holds the deepest USDC pool on base: $36.7M free of $378.7M deposited, " +
        "90% lent out. A $50k withdrawal clears on compound-v3 and would stall on moonwell. " +
        "moonwell at 100% is effectively locked: almost everything is lent out, so a " +
        "withdrawal of any size queues behind borrowers.",
    },
    run: (input) =>
      withdrawalRisk(
        String(input.asset ?? "USDC"),
        String(input.chain ?? "ethereum"),
        input.amountUsd === undefined ? undefined : Number(input.amountUsd),
      ),
  },

  {
    slug: "protocol-health",
    name: "Protocol health",
    category: "lending",
    author: "Onchain Router",
    summary: "Whether a protocol is growing or draining, and whether it earns anything from what it holds.",
    description:
      "Reads a protocol's standardized daily financials: where its deposits moved over " +
      "7 and 30 days, and what it earned in fees against what it holds. Calls it growing, " +
      "steady or draining, and says plainly when a protocol records no revenue at all. " +
      "Corrupt days in the source are discarded and reported.",
    price: "$0.01",
    coverage: `${HEALTH_PROTOCOLS.length} lending protocols, ${SUPPORTED_CHAINS.length} chains`,
    source: "graph",
    inputSchema: {
      protocol: z.enum([...HEALTH_PROTOCOLS] as [string, ...string[]]).describe("Protocol name"),
      chain: z
        .enum(["ethereum", "arbitrum", "base", "optimism", "polygon", "avalanche"])
        .describe("Chain the deployment runs on"),
    },
    example: {
      request: { protocol: "moonwell", chain: "base" },
      answer:
        "moonwell on base is draining: $39.5M deposited, -41.9% over 30 days. The last week " +
        "alone moved -23.6%. It earned $517k in fees over 30 days, about 15.9% a year on what " +
        "it holds, $61k of it kept by the protocol.",
    },
    run: (input) => protocolHealth(String(input.protocol ?? "aave-v3"), String(input.chain ?? "ethereum")),
  },

  {
    slug: "governance-pulse",
    name: "Governance pulse",
    category: "governance",
    author: "Onchain Router",
    summary: "Whether a protocol's governance is still deciding anything, and whether votes clear quorum.",
    description:
      "Reads the proposal history: when the last one went up, how many in the last 90 days " +
      "and the last year, how many ever passed, and how recent turnout compares to quorum. " +
      "Calls governance active, slow or quiet. Refuses to answer when the subgraph has seen " +
      "nothing for over a year, because dormant and moved-to-a-new-contract look identical.",
    price: "$0.01",
    coverage: `${LIVE_GOVERNANCE_PROTOCOLS.length} protocols`,
    source: "graph",
    inputSchema: {
      protocol: z
        .enum([...LIVE_GOVERNANCE_PROTOCOLS] as [string, ...string[]])
        .describe("Protocol whose proposal history to read"),
    },
    example: {
      request: { protocol: "ens" },
      answer:
        "ens governance is active: 6 proposals in the last 90 days, the latest 10 days ago. " +
        "68 of 75 proposals ever made were executed (91%). Turnout on recent votes ran 2.0x " +
        "quorum; participation is not the constraint.",
    },
    run: (input) => governancePulse(String(input.protocol ?? "uniswap")),
  },
];

export function findTool(slug: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

export type InputField = {
  name: string;
  type: string;
  description: string;
  required: boolean;
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
    let field = schema as z.ZodTypeAny;
    const description = field.description ?? "";
    const required = !(field instanceof z.ZodOptional);
    // Look through Optional to the type underneath for the rest of the description.
    if (field instanceof z.ZodOptional) field = field.unwrap() as z.ZodTypeAny;

    if (field instanceof z.ZodEnum) {
      const options = Object.values(field.options ?? {}).map(String);
      return { name, type: "enum", description, required, options };
    }

    if (field instanceof z.ZodNumber) return { name, type: "number", description, required };
    if (field instanceof z.ZodBoolean) return { name, type: "boolean", description, required };
    return { name, type: "string", description, required };
  });
}

export const CATEGORIES = [...new Set(TOOLS.map((t) => t.category))];

/** The catalogue as the site and any client sees it: everything but the code. */
export function catalogue() {
  return TOOLS.map(({ run: _run, inputSchema, ...rest }) => ({
    ...rest,
    inputs: Object.keys(inputSchema),
    hosted: !rest.endpoint,
  }));
}
