import { scanMarkets, money, type LendingMarket } from "@/lib/tools/lending-rates";
import { NoAnswer } from "@/lib/tools/no-answer";

/**
 * Can I get my money out?
 *
 * The rate a lending market pays says nothing about whether a deposit can leave.
 * What matters is how much of the pool is lent out: at 97% utilisation the
 * remaining 3% is all that any depositor can withdraw until borrowers repay, and a
 * withdrawal larger than that simply waits. This tool answers with the free
 * liquidity in dollars and what a given withdrawal would run into.
 */

/** Above this, withdrawals compete for the last few percent of the pool. */
const TIGHT_UTILISATION = 0.9;
/** Above this, a meaningful withdrawal is effectively queued behind repayments. */
const LOCKED_UTILISATION = 0.97;

export type WithdrawalMarket = {
  protocol: string;
  market: string;
  tvlUsd: number;
  borrowedUsd: number;
  freeUsd: number;
  utilisation: number;
  status: "open" | "tight" | "locked";
  /** Whether the requested amount clears the free liquidity, when one was given. */
  clears: boolean | null;
  stale: boolean;
  lastActivityDays: number | null;
};

export type WithdrawalRiskResult = {
  asset: string;
  chain: string;
  amountUsd: number | null;
  scanned: number;
  responded: number;
  markets: WithdrawalMarket[];
  assessment: string;
};

function statusOf(utilisation: number): WithdrawalMarket["status"] {
  if (utilisation >= LOCKED_UTILISATION) return "locked";
  if (utilisation >= TIGHT_UTILISATION) return "tight";
  return "open";
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export async function withdrawalRisk(
  assetInput: string,
  chainInput: string,
  amountUsd?: number,
): Promise<WithdrawalRiskResult> {
  const { asset, chain, scanned, responded, markets } = await scanMarkets(assetInput, chainInput);

  // Only markets where the asset is lent out and earns a rate. A pool that holds
  // USDC purely as collateral for something else has no withdrawal queue to speak of
  // and would only pad the list.
  const live = markets.filter((m) => !m.stale && m.depositedUsd > 0 && m.supplyRate !== null);
  if (live.length === 0) {
    throw new NoAnswer(`No live ${asset} market on ${chain} to measure.`);
  }

  const amount = amountUsd && amountUsd > 0 ? amountUsd : null;

  const judged: WithdrawalMarket[] = live
    .map((m: LendingMarket) => {
      // Borrows are measured against deposits, not TVL: some subgraphs publish TVL
      // net of borrows, which would read as 100% utilisation on every market.
      const freeUsd = Math.max(0, m.depositedUsd - m.borrowedUsd);
      const utilisation = m.depositedUsd > 0 ? Math.min(1, m.borrowedUsd / m.depositedUsd) : 0;
      return {
        protocol: m.protocol,
        market: m.market,
        tvlUsd: m.depositedUsd,
        borrowedUsd: m.borrowedUsd,
        freeUsd,
        utilisation,
        status: statusOf(utilisation),
        clears: amount === null ? null : freeUsd >= amount,
        stale: m.stale,
        lastActivityDays: m.lastActivityDays,
      };
    })
    .sort((a, b) => b.tvlUsd - a.tvlUsd);

  const answered = `${responded} of ${scanned} protocols answered.`;

  return {
    asset,
    chain,
    amountUsd: amount,
    scanned,
    responded,
    markets: judged.slice(0, 8),
    assessment: `${assess(asset, chain, amount, judged)} ${answered}`,
  };
}

/** A protocol with several markets for the asset is named by market, not repeated. */
function label(m: WithdrawalMarket, all: WithdrawalMarket[]): string {
  const siblings = all.filter((x) => x.protocol === m.protocol).length;
  return siblings > 1 ? `${m.protocol} (${m.market})` : m.protocol;
}

function assess(asset: string, chain: string, amount: number | null, markets: WithdrawalMarket[]): string {
  const lines: string[] = [];
  const name = (m: WithdrawalMarket) => label(m, markets);
  const locked = markets.filter((m) => m.status === "locked");
  const tight = markets.filter((m) => m.status === "tight");
  const biggest = markets[0];

  lines.push(
    `${name(biggest)} holds the deepest ${asset} pool on ${chain}: ${money(biggest.freeUsd)} free of ${money(biggest.tvlUsd)} deposited, ${pct(biggest.utilisation)} lent out.`,
  );

  if (amount !== null) {
    const clears = markets.filter((m) => m.clears);
    const blocked = markets.filter((m) => m.clears === false);
    if (clears.length === markets.length) {
      lines.push(`A ${money(amount)} withdrawal clears on every market right now.`);
    } else if (clears.length === 0) {
      lines.push(
        `No market can pay out ${money(amount)} at once; the most free liquidity anywhere is ${money(Math.max(...markets.map((m) => m.freeUsd)))}. That withdrawal waits for repayments.`,
      );
    } else {
      lines.push(
        `A ${money(amount)} withdrawal clears on ${clears.map(name).join(", ")} and would stall on ${blocked.map(name).join(", ")}.`,
      );
    }
  }

  if (locked.length > 0) {
    lines.push(
      `${locked.map((m) => `${name(m)} at ${pct(m.utilisation)}`).join(", ")} ${locked.length === 1 ? "is" : "are"} effectively locked: almost everything is lent out, so a withdrawal of any size queues behind borrowers.`,
    );
  } else if (tight.length > 0) {
    lines.push(
      `${tight.map((m) => `${name(m)} at ${pct(m.utilisation)}`).join(", ")} ${tight.length === 1 ? "is" : "are"} tight; small withdrawals clear, large ones may not.`,
    );
  } else if (amount === null) {
    lines.push(`Every live market is under ${pct(TIGHT_UTILISATION)} utilisation; withdrawals are not constrained today.`);
  }

  return lines.join(" ");
}
