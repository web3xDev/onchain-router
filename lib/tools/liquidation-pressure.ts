import { fanOut } from "@/lib/graph/client";
import { LENDING_DEPLOYMENTS, SUPPORTED_CHAINS } from "@/lib/graph/deployments";
import { NoAnswer } from "@/lib/tools/no-answer";
import { money, daysSince, STALE_AFTER_DAYS } from "@/lib/tools/lending-rates";

/**
 * Am I about to be liquidated?
 *
 * The rate and the free liquidity say what a market costs and whether money can
 * leave. Neither says what happens to a borrower while they hold. That is decided by
 * two things: how much of the market is actually being liquidated right now, and how
 * much room the market's own terms leave between "borrowed at the limit" and "seized".
 * The standardized market snapshot carries both, so one query reads them across every
 * protocol on a chain.
 */

/** Liquidating more than this share of what is borrowed, in a week, is a cascade. */
const CASCADING_7D = 0.01;
/** More than this is stress: liquidations are a daily event, not a rounding error. */
const STRESSED_7D = 0.001;
/** A week has to move at least this much before the change on the prior week is worth a sentence. */
const TREND_FLOOR_USD = 10_000;
/** Liquidations rising this many times week on week are called out. */
const RISING_MULTIPLE = 3;
/** A market smaller than this is not worth a sentence of its own, whatever its share. */
const MIN_MARKET_USD = 1_000_000;

const WEEK = 7 * 86400;

/**
 * Snapshots are only written on days the market saw activity, so a fortnight can be
 * fewer than fourteen rows. Twenty covers two weeks with room for a busy market that
 * snapshots more than once a day.
 */
const SNAPSHOTS = 20;

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
      liquidationThreshold
      liquidationPenalty
      dailySnapshots(first: ${SNAPSHOTS}, orderBy: timestamp, orderDirection: desc) {
        timestamp
        dailyLiquidateUSD
        totalDepositBalanceUSD
        totalBorrowBalanceUSD
      }
    }
  }
`;

type RawSnapshot = {
  timestamp: string;
  dailyLiquidateUSD: string;
  totalDepositBalanceUSD?: string;
  totalBorrowBalanceUSD?: string;
};

type RawMarket = {
  name: string | null;
  isActive: boolean;
  totalValueLockedUSD: string;
  totalDepositBalanceUSD?: string;
  totalBorrowBalanceUSD: string;
  maximumLTV: string;
  liquidationThreshold: string;
  liquidationPenalty: string;
  dailySnapshots?: RawSnapshot[];
};

export type LiquidationMarket = {
  protocol: string;
  market: string;
  depositedUsd: number;
  borrowedUsd: number;
  /** Liquidated in the last 7 days, and in the 7 before that. */
  liquidated7dUsd: number;
  liquidatedPrior7dUsd: number;
  /** Last 7 days of liquidations as a share of what is borrowed. */
  share7d: number;
  /** Percent of collateral value that can be borrowed, and the percent at which it is seized. */
  maxLtv: number | null;
  liquidationThreshold: number | null;
  liquidationPenalty: number | null;
  /**
   * How far price has to fall before a position opened at max LTV is liquidated.
   * The gap between LTV and threshold, as a share of price. Null when the market
   * publishes no usable terms.
   */
  priceBuffer: number | null;
  /** Days in the window thrown out as impossible. */
  discardedDays: number;
  lastActivityDays: number | null;
};

export type LiquidationPressureResult = {
  asset: string;
  chain: string;
  scanned: number;
  responded: number;
  borrowedUsd: number;
  liquidated7dUsd: number;
  liquidatedPrior7dUsd: number;
  share7d: number;
  status: "calm" | "stressed" | "cascading";
  markets: LiquidationMarket[];
  assessment: string;
};

function statusOf(share: number): LiquidationPressureResult["status"] {
  if (share >= CASCADING_7D) return "cascading";
  if (share >= STRESSED_7D) return "stressed";
  return "calm";
}

/**
 * Loan terms as percentages, or null when the market publishes nothing usable.
 *
 * Compound V3 lists its base-asset market with an LTV of 0 and a threshold of 0.01,
 * because the base asset is not collateral there. Some deployments write the terms as
 * fractions. Anything without a threshold above its LTV has no buffer to measure.
 */
function terms(m: RawMarket): { ltv: number; threshold: number; penalty: number } | null {
  let ltv = Number(m.maximumLTV);
  let threshold = Number(m.liquidationThreshold);
  let penalty = Number(m.liquidationPenalty);
  if (!Number.isFinite(ltv) || !Number.isFinite(threshold)) return null;
  if (threshold <= 1 && ltv <= 1) {
    ltv *= 100;
    threshold *= 100;
    penalty *= 100;
  }
  if (ltv <= 0 || threshold <= ltv || threshold > 100) return null;
  return { ltv, threshold, penalty: Number.isFinite(penalty) ? penalty : 0 };
}

/** "an 86%" but "a 78%": the article follows the sound of the number. */
function article(n: number): string {
  const s = String(n);
  return s.startsWith("8") || s === "11" || s === "18" || s.startsWith("11.") || s.startsWith("18.") ? "an" : "a";
}

function sharePct(value: number): string {
  if (value === 0) return "0%";
  if (value < 0.0001) return "under 0.01%";
  return `${(value * 100).toFixed(2)}%`;
}

export async function liquidationPressure(
  assetInput: string,
  chainInput: string,
): Promise<LiquidationPressureResult> {
  const asset = assetInput.trim().toUpperCase();
  const chain = chainInput.trim().toLowerCase();

  const deployments = LENDING_DEPLOYMENTS[chain];
  if (!deployments) {
    throw new Error(`Unsupported chain "${chain}". Supported: ${SUPPORTED_CHAINS.join(", ")}`);
  }

  const responses = await fanOut<{ markets: RawMarket[] }>(deployments, MARKETS_QUERY, { symbol: asset });
  const now = Date.now() / 1000;

  // The isActive flag is not trusted here. aave-v3 on ethereum marks its WETH market
  // inactive while it carries $4.4B of borrows and snapshots every day; the same
  // deployment says USDC and WBTC cannot be collateral. Whether a market is live is
  // read off its own behaviour below: recent activity and something borrowed.
  const markets: LiquidationMarket[] = responses.flatMap(({ protocol, data }) =>
    (data.markets ?? [])
      .map((m) => {
        const tvlUsd = Number(m.totalValueLockedUSD);
        const depositedUsd = Number(m.totalDepositBalanceUSD ?? 0) || tvlUsd;
        const borrowedUsd = Number(m.totalBorrowBalanceUSD);
        const snaps = m.dailySnapshots ?? [];

        // One corrupt day can carry more than the market has ever held. A day cannot
        // liquidate more than the market had on deposit or on loan that day, so days
        // that claim to are thrown out and reported, not summed.
        let liquidated7dUsd = 0;
        let liquidatedPrior7dUsd = 0;
        let discardedDays = 0;
        for (const s of snaps) {
          const at = Number(s.timestamp);
          if (at < now - 2 * WEEK) continue;
          const value = Number(s.dailyLiquidateUSD || 0);
          if (value <= 0) continue;
          const bound = Math.max(
            Number(s.totalDepositBalanceUSD ?? 0),
            Number(s.totalBorrowBalanceUSD ?? 0),
            depositedUsd,
            borrowedUsd,
          );
          if (bound > 0 && value > bound) {
            discardedDays += 1;
            continue;
          }
          if (at >= now - WEEK) liquidated7dUsd += value;
          else liquidatedPrior7dUsd += value;
        }

        const t = terms(m);
        return {
          protocol,
          market: m.name ?? `${protocol} ${asset}`,
          depositedUsd,
          borrowedUsd,
          liquidated7dUsd,
          liquidatedPrior7dUsd,
          share7d: borrowedUsd > 0 ? liquidated7dUsd / borrowedUsd : 0,
          maxLtv: t?.ltv ?? null,
          liquidationThreshold: t?.threshold ?? null,
          liquidationPenalty: t?.penalty ?? null,
          priceBuffer: t ? 1 - t.ltv / t.threshold : null,
          discardedDays,
          lastActivityDays: daysSince(snaps[0]?.timestamp),
        };
      }),
  );

  // Only markets with something at stake. A market nobody borrows from cannot
  // liquidate anyone, and a frozen one is reporting a number, not a risk.
  const live = markets.filter(
    (m) => m.borrowedUsd > 0 && m.lastActivityDays !== null && m.lastActivityDays <= STALE_AFTER_DAYS,
  );

  if (markets.length === 0) {
    throw new NoAnswer(`No active ${asset} market on any indexed lending protocol on ${chain}.`);
  }
  if (live.length === 0) {
    throw new NoAnswer(
      `Nothing is borrowed in any live ${asset} market on ${chain}. There is no position to liquidate and nothing to measure.`,
    );
  }

  live.sort((a, b) => b.borrowedUsd - a.borrowedUsd);

  const borrowedUsd = live.reduce((s, m) => s + m.borrowedUsd, 0);
  const liquidated7dUsd = live.reduce((s, m) => s + m.liquidated7dUsd, 0);
  const liquidatedPrior7dUsd = live.reduce((s, m) => s + m.liquidatedPrior7dUsd, 0);
  const share7d = borrowedUsd > 0 ? liquidated7dUsd / borrowedUsd : 0;
  const status = statusOf(share7d);

  const answered = `${responses.length} of ${deployments.length} protocols answered.`;

  return {
    asset,
    chain,
    scanned: deployments.length,
    responded: responses.length,
    borrowedUsd,
    liquidated7dUsd,
    liquidatedPrior7dUsd,
    share7d,
    status,
    markets: live.slice(0, 8),
    assessment: `${assess(asset, chain, status, borrowedUsd, liquidated7dUsd, liquidatedPrior7dUsd, share7d, live)} ${answered}`,
  };
}

/** A protocol with several markets for the asset is named by market, not repeated. */
function label(m: LiquidationMarket, all: LiquidationMarket[]): string {
  const siblings = all.filter((x) => x.protocol === m.protocol).length;
  return siblings > 1 ? `${m.protocol} (${m.market})` : m.protocol;
}

function assess(
  asset: string,
  chain: string,
  status: LiquidationPressureResult["status"],
  borrowedUsd: number,
  liquidated7dUsd: number,
  liquidatedPrior7dUsd: number,
  share7d: number,
  markets: LiquidationMarket[],
): string {
  const lines: string[] = [];
  const name = (m: LiquidationMarket) => label(m, markets);
  const where = markets.length === 1 ? `its one live market` : `${markets.length} live markets`;

  if (status === "cascading") {
    lines.push(
      `${asset} on ${chain} is cascading: ${money(liquidated7dUsd)} liquidated across ${where} in 7 days, ${sharePct(share7d)} of the ${money(borrowedUsd)} borrowed. Positions are being closed faster than borrowers are closing them.`,
    );
  } else if (status === "stressed") {
    lines.push(
      `${asset} on ${chain} is stressed: ${money(liquidated7dUsd)} liquidated across ${where} in 7 days, ${sharePct(share7d)} of the ${money(borrowedUsd)} borrowed. Not a cascade, but liquidations are a daily event.`,
    );
  } else if (liquidated7dUsd === 0) {
    lines.push(
      `${asset} on ${chain} is calm: nothing was liquidated across ${where} in the last 7 days, against ${money(borrowedUsd)} borrowed.`,
    );
  } else {
    lines.push(
      `${asset} on ${chain} is calm: ${money(liquidated7dUsd)} liquidated across ${where} in 7 days, ${sharePct(share7d)} of the ${money(borrowedUsd)} borrowed.`,
    );
  }

  // Direction matters more than level, but only between two weeks that both count.
  // $21k against $9 the week before is not "2,300x and rising", it is a quiet week
  // after a silent one.
  const thisWeekCounts = liquidated7dUsd >= TREND_FLOOR_USD;
  const priorWeekCounts = liquidatedPrior7dUsd >= TREND_FLOOR_USD;
  if (thisWeekCounts && !priorWeekCounts) {
    lines.push(liquidatedPrior7dUsd === 0 ? `The week before saw none.` : `The week before saw almost none.`);
  } else if (!thisWeekCounts && priorWeekCounts) {
    lines.push(`Down from ${money(liquidatedPrior7dUsd)} the week before; the pressure is easing.`);
  } else if (thisWeekCounts && priorWeekCounts) {
    if (liquidated7dUsd >= liquidatedPrior7dUsd * RISING_MULTIPLE) {
      lines.push(`That is ${(liquidated7dUsd / liquidatedPrior7dUsd).toFixed(1)}x the week before, and rising.`);
    } else if (liquidatedPrior7dUsd >= liquidated7dUsd * RISING_MULTIPLE) {
      lines.push(`Down from ${money(liquidatedPrior7dUsd)} the week before; the pressure is easing.`);
    }
  }

  // Where it lands, when one market carries most of it.
  const busiest = [...markets].sort((a, b) => b.liquidated7dUsd - a.liquidated7dUsd)[0];
  if (thisWeekCounts && busiest.liquidated7dUsd / liquidated7dUsd >= 0.7 && markets.length > 1) {
    lines.push(`Almost all of it, ${money(busiest.liquidated7dUsd)}, was on ${name(busiest)}.`);
  }

  // A chain total is dominated by its deepest market. A small market can be in
  // real trouble underneath a calm headline, and a borrower there needs to know.
  if (status === "calm") {
    const troubled = markets
      .filter((m) => m.borrowedUsd >= MIN_MARKET_USD && statusOf(m.share7d) !== "calm")
      .sort((a, b) => b.share7d - a.share7d)[0];
    if (troubled) {
      lines.push(
        `${name(troubled)} on its own is ${statusOf(troubled.share7d)}: ${money(troubled.liquidated7dUsd)} liquidated against ${money(troubled.borrowedUsd)} borrowed, ${sharePct(troubled.share7d)} in a week.`,
      );
    }
  }

  // The terms: how far price has to fall before a position at the limit is seized.
  // Read off markets people actually borrow from; a dust market's terms bind nobody.
  const priced = markets.filter((m) => m.priceBuffer !== null);
  const withTerms = priced.some((m) => m.borrowedUsd >= MIN_MARKET_USD)
    ? priced.filter((m) => m.borrowedUsd >= MIN_MARKET_USD)
    : priced;
  if (withTerms.length > 0) {
    const tightest = [...withTerms].sort((a, b) => a.priceBuffer! - b.priceBuffer!)[0];
    const penalty = tightest.liquidationPenalty ? `, with a ${tightest.liquidationPenalty}% penalty` : "";
    lines.push(
      `Tightest terms are on ${name(tightest)}: ${tightest.maxLtv}% max LTV against ${article(tightest.liquidationThreshold!)} ${tightest.liquidationThreshold}% threshold, so a position opened at the limit is ${(tightest.priceBuffer! * 100).toFixed(1)}% of price from liquidation${penalty}.`,
    );
    const loosest = [...withTerms].sort((a, b) => b.priceBuffer! - a.priceBuffer!)[0];
    if (loosest !== tightest && loosest.priceBuffer! - tightest.priceBuffer! >= 0.03) {
      lines.push(`${name(loosest)} leaves ${(loosest.priceBuffer! * 100).toFixed(1)}%.`);
    }
  }

  const discarded = markets.reduce((s, m) => s + m.discardedDays, 0);
  if (discarded > 0) {
    lines.push(
      `${discarded} day${discarded === 1 ? "" : "s"} of liquidation data ${discarded === 1 ? "was" : "were"} discarded as impossible.`,
    );
  }

  return lines.join(" ");
}
