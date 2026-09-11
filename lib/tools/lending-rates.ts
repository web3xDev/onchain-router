import { fanOut } from "@/lib/graph/client";
import { LENDING_DEPLOYMENTS, SUPPORTED_CHAINS } from "@/lib/graph/deployments";
import { NoAnswer } from "@/lib/tools/no-answer";

/**
 * Where should an agent lend or borrow a given asset?
 *
 * Every lending protocol here publishes to the same standardized schema, so one query
 * answers the question across all of them. There is no per-protocol integration: add
 * a deployment id and it joins the comparison.
 *
 * The tool returns a decision rather than a table. A rate on its own is
 * misleading, because a thin market can advertise a high rate it cannot honour at
 * size, so rates are
 * weighed against the liquidity behind them.
 */

/** A market thinner than this is treated as unreliable regardless of its rate. */
const MIN_TRUSTWORTHY_TVL_USD = 250_000;

/**
 * A rate this many times the median is treated as an artefact rather than an offer.
 *
 * Depth alone does not make a rate real. Abandoned protocols keep publishing to their
 * subgraph, and a market that stopped being maintained can report a healthy TVL beside
 * a rate nothing could actually pay: 75% on a stablecoin while every live market sits
 * near 4%. Ranking on the raw number recommends the dead protocol with confidence.
 */
const OUTLIER_MULTIPLE = 5;

/**
 * A market with no activity for this long is treated as dead.
 *
 * The rate check above catches an abandoned protocol whose numbers drifted somewhere
 * absurd. It does not catch one whose numbers froze looking normal: Rari Fuse still
 * publishes a 3% USDC rate beside $8M of TVL, and its last recorded activity was four
 * years ago. The indexer is at the chain head, so the subgraph looks fresh; only the
 * market's own last snapshot says nobody has touched it.
 */
const STALE_AFTER_DAYS = 30;

const MARKETS_QUERY = `
  query Markets($symbol: String!) {
    markets(
      where: { inputToken_: { symbol: $symbol } }
      orderBy: totalValueLockedUSD
      orderDirection: desc
      first: 3
    ) {
      name
      isActive
      totalValueLockedUSD
      totalDepositBalanceUSD
      totalBorrowBalanceUSD
      maximumLTV
      rates { side type rate }
      dailySnapshots(first: 1, orderBy: timestamp, orderDirection: desc) { timestamp }
    }
  }
`;

type RawMarket = {
  name: string;
  isActive: boolean;
  totalValueLockedUSD: string;
  totalDepositBalanceUSD?: string;
  totalBorrowBalanceUSD: string;
  maximumLTV: string;
  rates: { side: string; type: string; rate: string }[];
  dailySnapshots?: { timestamp: string }[];
};

export type LendingMarket = {
  protocol: string;
  market: string;
  tvlUsd: number;
  /** Total deposits. Some subgraphs report TVL net of borrows, so this is kept apart. */
  depositedUsd: number;
  borrowedUsd: number;
  supplyRate: number | null;
  borrowRate: number | null;
  maxLtv: number;
  trustworthy: boolean;
  /** Days since the market last recorded any activity; null when it never has. */
  lastActivityDays: number | null;
  /** No activity for longer than STALE_AFTER_DAYS. A frozen number, not an offer. */
  stale: boolean;
  /** Rate is a statistical outlier against the rest of the chain, treated as stale. */
  anomalous?: boolean;
};

export type LendingRatesResult = {
  asset: string;
  chain: string;
  scanned: number;
  responded: number;
  withMarket: number;
  best: LendingMarket | null;
  assessment: string;
  markets: LendingMarket[];
};

function pickRate(rates: RawMarket["rates"], side: string): number | null {
  const match = rates.find((r) => r.side === side && r.type === "VARIABLE")
    ?? rates.find((r) => r.side === side);
  return match ? Number(match.rate) : null;
}

function medianRate(rates: number[]): number {
  if (rates.length === 0) return 0;
  const sorted = [...rates].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function daysSince(timestamp: string | undefined): number | null {
  if (!timestamp) return null;
  return Math.floor((Date.now() / 1000 - Number(timestamp)) / 86400);
}

function ago(days: number): string {
  if (days >= 365) {
    const years = Math.floor(days / 365);
    return years === 1 ? "over a year" : `over ${years} years`;
  }
  if (days >= 60) return `${Math.floor(days / 30)} months`;
  return `${days} days`;
}

function money(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${Math.round(value)}`;
}

export { ago, money, daysSince };

/**
 * Every active market for an asset on a chain, across every indexed lending
 * protocol, with staleness already judged. Shared by the tools that ask different
 * questions of the same markets.
 */
export async function scanMarkets(
  assetInput: string,
  chainInput: string,
): Promise<{ asset: string; chain: string; scanned: number; responded: number; markets: LendingMarket[] }> {
  const asset = assetInput.trim().toUpperCase();
  const chain = chainInput.trim().toLowerCase();

  const deployments = LENDING_DEPLOYMENTS[chain];
  if (!deployments) {
    throw new Error(`Unsupported chain "${chain}". Supported: ${SUPPORTED_CHAINS.join(", ")}`);
  }

  const responses = await fanOut<{ markets: RawMarket[] }>(deployments, MARKETS_QUERY, { symbol: asset });

  const markets: LendingMarket[] = responses.flatMap(({ protocol, data }) =>
    (data.markets ?? [])
      .filter((m) => m.isActive)
      .map((m) => {
        const tvlUsd = Number(m.totalValueLockedUSD);
        const depositedUsd = Number(m.totalDepositBalanceUSD ?? 0) || tvlUsd;
        const lastActivityDays = daysSince(m.dailySnapshots?.[0]?.timestamp);
        const stale = lastActivityDays === null || lastActivityDays > STALE_AFTER_DAYS;
        return {
          protocol,
          market: m.name,
          tvlUsd,
          depositedUsd,
          borrowedUsd: Number(m.totalBorrowBalanceUSD),
          supplyRate: pickRate(m.rates, "LENDER"),
          borrowRate: pickRate(m.rates, "BORROWER"),
          maxLtv: Number(m.maximumLTV),
          trustworthy: tvlUsd >= MIN_TRUSTWORTHY_TVL_USD && !stale,
          lastActivityDays,
          stale,
        };
      }),
  );

  return { asset, chain, scanned: deployments.length, responded: responses.length, markets };
}

export async function lendingRates(assetInput: string, chainInput: string): Promise<LendingRatesResult> {
  const { asset, chain, scanned, responded, markets } = await scanMarkets(assetInput, chainInput);

  markets.sort((a, b) => (b.supplyRate ?? -1) - (a.supplyRate ?? -1));

  const deep = markets.filter((m) => m.trustworthy && m.supplyRate !== null);

  // Flag rates that stand far apart from what the rest of the chain is paying.
  const median = medianRate(deep.map((m) => m.supplyRate!));
  if (median > 0) {
    for (const m of deep) {
      if (m.supplyRate! > median * OUTLIER_MULTIPLE) m.anomalous = true;
    }
  }

  const trustworthy = deep.filter((m) => !m.anomalous);
  const best = trustworthy[0] ?? null;

  // No verdict, no charge. A list of markets that cannot be trusted is not an
  // answer to "where should I lend", and is not sold as one.
  if (markets.length === 0) {
    throw new NoAnswer(`No active ${asset} market on any indexed lending protocol on ${chain}.`);
  }
  if (!best) {
    throw new NoAnswer(
      `Every ${asset} market on ${chain} is either thinner than ${money(MIN_TRUSTWORTHY_TVL_USD)}, stale, or reporting a rate nothing could pay. Nothing here can be recommended.`,
    );
  }

  return {
    asset,
    chain,
    scanned,
    responded,
    withMarket: markets.length,
    best,
    assessment: assess(asset, markets, trustworthy, best),
    markets: markets.slice(0, 8),
  };
}

/** Turns the comparison into a decision, and says what was discarded and why. */
function assess(
  asset: string,
  all: LendingMarket[],
  trustworthy: LendingMarket[],
  best: LendingMarket | null,
): string {
  if (all.length === 0) return `No active ${asset} market found on any indexed lending protocol.`;
  if (!best) {
    return `Every ${asset} market found is thinner than ${money(MIN_TRUSTWORTHY_TVL_USD)}, so none of the advertised rates can be trusted at size.`;
  }

  const lines: string[] = [];
  lines.push(
    `Best supply rate: ${best.supplyRate!.toFixed(2)}% on ${best.protocol}, backed by ${money(best.tvlUsd)} of liquidity.`,
  );

  // What was discarded, and why, is the most useful part of the answer.
  const outlier = all.find((m) => m.anomalous && (m.supplyRate ?? 0) > best.supplyRate!);
  if (outlier) {
    lines.push(
      `${outlier.protocol} reports ${outlier.supplyRate!.toFixed(2)}%, far outside what every live market on this chain pays. Read as stale data from an abandoned protocol, not an offer.`,
    );
  }

  const dead = all.find((m) => m.stale && (m.supplyRate ?? 0) > best.supplyRate!);
  if (dead) {
    lines.push(
      dead.lastActivityDays === null
        ? `${dead.protocol} lists ${dead.supplyRate!.toFixed(2)}% but has never recorded any activity. Not an offer.`
        : `${dead.protocol} lists ${dead.supplyRate!.toFixed(2)}% but has seen no activity in ${ago(dead.lastActivityDays)}. A frozen number, not an offer.`,
    );
  }

  const thin = all.find((m) => !m.trustworthy && !m.stale && (m.supplyRate ?? 0) > best.supplyRate!);
  if (thin) {
    lines.push(
      `${thin.protocol} advertises ${thin.supplyRate!.toFixed(2)}% but holds only ${money(thin.tvlUsd)}, too thin to rely on at size.`,
    );
  }

  const runnerUp = trustworthy[1];
  if (runnerUp && best.supplyRate! > 0) {
    const gap = best.supplyRate! - (runnerUp.supplyRate ?? 0);
    if (gap > 1) {
      lines.push(
        `Next best is ${runnerUp.protocol} at ${runnerUp.supplyRate!.toFixed(2)}%, ${gap.toFixed(2)} points behind.`,
      );
    }
  }

  if (best.borrowRate !== null) {
    lines.push(`Borrowing ${asset} there costs ${best.borrowRate.toFixed(2)}%.`);
  }

  return lines.join(" ");
}
