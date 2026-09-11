import { queryWithRetry } from "@/lib/graph/client";
import { LENDING_DEPLOYMENTS, SUPPORTED_CHAINS } from "@/lib/graph/deployments";
import { NoAnswer } from "@/lib/tools/no-answer";
import { money, ago } from "@/lib/tools/lending-rates";

/**
 * Is this protocol alive, and is it paying its own way?
 *
 * Two things a TVL number on a dashboard does not say: which way it is moving, and
 * whether the protocol earns anything from it. A pool can hold a billion dollars
 * and be quietly bleeding out; another can be small and cash-flow positive. The
 * standardized daily financial snapshot answers both across every protocol on the
 * network with one query.
 */

/** Losing more than this share of TVL in 30 days is read as draining. */
const DRAINING_30D = -0.15;
/** Gaining more than this in 30 days is read as growing. */
const GROWING_30D = 0.15;
/** A protocol whose last snapshot is older than this is not reporting. */
const STALE_AFTER_DAYS = 14;

const FINANCIALS_QUERY = `
  query Financials {
    financialsDailySnapshots(first: 31, orderBy: timestamp, orderDirection: desc) {
      timestamp
      totalValueLockedUSD
      dailyTotalRevenueUSD
      dailyProtocolSideRevenueUSD
      dailySupplySideRevenueUSD
    }
  }
`;

type RawSnapshot = {
  timestamp: string;
  totalValueLockedUSD: string;
  dailyTotalRevenueUSD: string;
  dailyProtocolSideRevenueUSD: string;
  dailySupplySideRevenueUSD: string;
};

export type ProtocolHealthResult = {
  protocol: string;
  chain: string;
  tvlUsd: number;
  tvl7dChange: number | null;
  tvl30dChange: number | null;
  revenue30dUsd: number;
  protocolRevenue30dUsd: number;
  /** 30-day revenue annualised, as a share of current TVL. */
  revenueYieldAnnual: number | null;
  /** Days in the window thrown out as corrupt. */
  discardedDays: number;
  lastSnapshotDays: number;
  trend: "growing" | "stable" | "draining";
  earning: boolean;
  assessment: string;
};

/** Every (protocol, chain) pair the financials tool can be asked about. */
export const HEALTH_PROTOCOLS = [
  ...new Set(Object.values(LENDING_DEPLOYMENTS).flat().map((d) => d.protocol)),
].sort();

function change(now: number, then: number | undefined): number | null {
  if (then === undefined || then <= 0) return null;
  return (now - then) / then;
}

function pct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}%`;
}

export async function protocolHealth(protocolInput: string, chainInput: string): Promise<ProtocolHealthResult> {
  const protocol = protocolInput.trim().toLowerCase();
  const chain = chainInput.trim().toLowerCase();

  const deployments = LENDING_DEPLOYMENTS[chain];
  if (!deployments) {
    throw new Error(`Unsupported chain "${chain}". Supported: ${SUPPORTED_CHAINS.join(", ")}`);
  }
  const deployment = deployments.find((d) => d.protocol === protocol);
  if (!deployment) {
    throw new NoAnswer(`${protocol} is not indexed on ${chain}.`);
  }

  const data = await queryWithRetry<{ financialsDailySnapshots: RawSnapshot[] }>(
    deployment.id,
    FINANCIALS_QUERY,
    undefined,
    15000,
  );
  const snaps = data?.financialsDailySnapshots ?? [];
  if (snaps.length === 0) {
    throw new NoAnswer(`${protocol} on ${chain} publishes no financial snapshots.`);
  }

  const latest = snaps[0];
  const lastSnapshotDays = Math.floor((Date.now() / 1000 - Number(latest.timestamp)) / 86400);
  if (lastSnapshotDays > STALE_AFTER_DAYS) {
    throw new NoAnswer(
      `${protocol} on ${chain} stopped reporting ${ago(lastSnapshotDays)} ago. Whatever it holds now, this source cannot say.`,
    );
  }

  const tvlUsd = Number(latest.totalValueLockedUSD);
  const tvl = (i: number) => (snaps[i] ? Number(snaps[i].totalValueLockedUSD) : undefined);
  const tvl7dChange = change(tvlUsd, tvl(7));
  const tvl30dChange = change(tvlUsd, tvl(30) ?? tvl(snaps.length - 1));

  // A single corrupt day can carry a number ten million times the rest (aave-v3
  // on ethereum has one at 58 trillion dollars). Days more than twenty times the
  // median are discarded and the window is scaled back to 30 days.
  const window = snaps.slice(0, 30);
  const daily = window.map((x) => Number(x.dailyTotalRevenueUSD || 0));
  const dailyProtocol = window.map((x) => Number(x.dailyProtocolSideRevenueUSD || 0));
  const sorted = [...daily].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const keep = daily.map((v) => median <= 0 || v <= median * 20);
  const kept = keep.filter(Boolean).length;
  const discarded = daily.length - kept;
  const scale = kept > 0 ? 30 / kept : 0;
  const revenue30dUsd = daily.reduce((s, v, i) => (keep[i] ? s + v : s), 0) * scale;
  const protocolRevenue30dUsd = dailyProtocol.reduce((s, v, i) => (keep[i] ? s + v : s), 0) * scale;
  const revenueYieldAnnual = tvlUsd > 0 ? (revenue30dUsd * (365 / 30)) / tvlUsd : null;

  const trend: ProtocolHealthResult["trend"] =
    tvl30dChange !== null && tvl30dChange <= DRAINING_30D
      ? "draining"
      : tvl30dChange !== null && tvl30dChange >= GROWING_30D
        ? "growing"
        : "stable";
  const earning = revenue30dUsd > 0;

  return {
    protocol,
    chain,
    tvlUsd,
    tvl7dChange,
    tvl30dChange,
    revenue30dUsd,
    protocolRevenue30dUsd,
    revenueYieldAnnual,
    discardedDays: discarded,
    lastSnapshotDays,
    trend,
    earning,
    assessment: assess({
      protocol, chain, tvlUsd, tvl7dChange, tvl30dChange, revenue30dUsd, protocolRevenue30dUsd,
      revenueYieldAnnual, discardedDays: discarded, lastSnapshotDays, trend, earning, assessment: "",
    }),
  };
}

function assess(r: ProtocolHealthResult): string {
  const lines: string[] = [];

  const move = r.tvl30dChange === null ? "" : ` ${pct(r.tvl30dChange)} over 30 days`;
  if (r.trend === "draining") {
    lines.push(`${r.protocol} on ${r.chain} is draining: ${money(r.tvlUsd)} deposited,${move}.`);
  } else if (r.trend === "growing") {
    lines.push(`${r.protocol} on ${r.chain} is growing: ${money(r.tvlUsd)} deposited,${move}.`);
  } else {
    lines.push(`${r.protocol} on ${r.chain} is holding steady at ${money(r.tvlUsd)}${move ? "," + move : ""}.`);
  }

  if (r.tvl7dChange !== null && Math.abs(r.tvl7dChange) >= 0.1) {
    lines.push(`The last week alone moved ${pct(r.tvl7dChange)}.`);
  }

  if (!r.earning) {
    lines.push(`It recorded no revenue in the last 30 days. Whatever keeps it running, it is not fees.`);
  } else {
    const yieldText =
      r.revenueYieldAnnual !== null ? `, about ${(r.revenueYieldAnnual * 100).toFixed(1)}% a year on what it holds` : "";
    lines.push(
      `It earned ${money(r.revenue30dUsd)} in fees over 30 days${yieldText}, ${money(r.protocolRevenue30dUsd)} of it kept by the protocol.`,
    );
  }

  if (r.discardedDays > 0) {
    lines.push(`${r.discardedDays} day${r.discardedDays === 1 ? "" : "s"} of revenue data ${r.discardedDays === 1 ? "was" : "were"} discarded as corrupt.`);
  }

  return lines.join(" ");
}
