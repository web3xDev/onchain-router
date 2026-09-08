import { fanOut } from "@/lib/graph/client";
import { LENDING_DEPLOYMENTS, SUPPORTED_CHAINS } from "@/lib/graph/deployments";

/**
 * Where should an agent lend or borrow a given asset?
 *
 * Every lending protocol here publishes to the same standardized schema, so one query
 * answers the question across all of them. There is no per-protocol integration: add
 * a deployment id and it joins the comparison.
 *
 * The tool returns a decision rather than a table. A rate on its own is misleading —
 * a thin market can advertise a high rate it cannot honour at size — so rates are
 * weighed against the liquidity behind them.
 */

/** A market thinner than this is treated as unreliable regardless of its rate. */
const MIN_TRUSTWORTHY_TVL_USD = 250_000;

/**
 * A rate this many times the median is treated as an artefact rather than an offer.
 *
 * Depth alone does not make a rate real. Abandoned protocols keep publishing to their
 * subgraph, and a market that stopped being maintained can report a healthy TVL beside
 * a rate nothing could actually pay — 75% on a stablecoin while every live market sits
 * near 4%. Ranking on the raw number recommends the dead protocol with confidence.
 */
const OUTLIER_MULTIPLE = 5;

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
      totalBorrowBalanceUSD
      maximumLTV
      rates { side type rate }
    }
  }
`;

type RawMarket = {
  name: string;
  isActive: boolean;
  totalValueLockedUSD: string;
  totalBorrowBalanceUSD: string;
  maximumLTV: string;
  rates: { side: string; type: string; rate: string }[];
};

export type LendingMarket = {
  protocol: string;
  market: string;
  tvlUsd: number;
  borrowedUsd: number;
  supplyRate: number | null;
  borrowRate: number | null;
  maxLtv: number;
  trustworthy: boolean;
  /** Rate is a statistical outlier against the rest of the chain — treated as stale. */
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

function money(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${Math.round(value)}`;
}

export async function lendingRates(assetInput: string, chainInput: string): Promise<LendingRatesResult> {
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
        return {
          protocol,
          market: m.name,
          tvlUsd,
          borrowedUsd: Number(m.totalBorrowBalanceUSD),
          supplyRate: pickRate(m.rates, "LENDER"),
          borrowRate: pickRate(m.rates, "BORROWER"),
          maxLtv: Number(m.maximumLTV),
          trustworthy: tvlUsd >= MIN_TRUSTWORTHY_TVL_USD,
        };
      }),
  );

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

  return {
    asset,
    chain,
    scanned: deployments.length,
    responded: responses.length,
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
      `${outlier.protocol} reports ${outlier.supplyRate!.toFixed(2)}%, far outside what every live market on this chain pays — read as stale data from an abandoned protocol, not an offer.`,
    );
  }

  const thin = all.find((m) => !m.trustworthy && (m.supplyRate ?? 0) > best.supplyRate!);
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
