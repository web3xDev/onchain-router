import { queryWithRetry } from "@/lib/graph/client";
import { GOVERNANCE_DEPLOYMENTS } from "@/lib/graph/deployments";
import { NoAnswer } from "@/lib/tools/no-answer";
import { ago } from "@/lib/tools/lending-rates";

/**
 * Is this governance alive?
 *
 * Governance power says who could decide. This says whether anyone is deciding
 * at all: when the last proposal went up, how often they go up, how many pass,
 * and whether the votes that show up actually clear quorum.
 *
 * A subgraph that has seen no proposal in over a year is not answered. Governance
 * may have gone quiet or it may have moved to a new contract the subgraph does not
 * watch; the data cannot tell those apart, so it is not sold as if it could.
 */

const QUIET_AFTER_DAYS = 180;
const UNANSWERABLE_AFTER_DAYS = 365;

const PULSE_QUERY = `
  query Pulse {
    governances {
      proposals
      proposalsExecuted
      proposalsCanceled
      currentDelegates
    }
    governanceFrameworks { quorumVotes }
    proposals(first: 25, orderBy: creationTime, orderDirection: desc) {
      state
      creationTime
      forWeightedVotes
      againstWeightedVotes
      quorumVotes
    }
  }
`;

type Raw = {
  governances: { proposals: string; proposalsExecuted: string; proposalsCanceled: string; currentDelegates: string }[];
  governanceFrameworks: { quorumVotes: string }[];
  proposals: {
    state: string;
    creationTime: string;
    forWeightedVotes: string;
    againstWeightedVotes: string;
    quorumVotes: string;
  }[];
};

export type GovernancePulseResult = {
  protocol: string;
  daysSinceLastProposal: number;
  proposalsLast90d: number;
  proposalsLast365d: number;
  proposalsTotal: number;
  executedTotal: number;
  /** Share of all proposals that ended executed. */
  passRate: number | null;
  /** Average turnout on the last five proposals, as a multiple of quorum. */
  turnoutVsQuorum: number | null;
  lastState: string;
  pulse: "active" | "slow" | "quiet";
  assessment: string;
};

const DAY = 86400;

export async function governancePulse(protocolInput: string): Promise<GovernancePulseResult> {
  const protocol = protocolInput.trim().toLowerCase();
  const deployment = GOVERNANCE_DEPLOYMENTS.find((d) => d.protocol === protocol);
  if (!deployment) throw new NoAnswer(`Unknown protocol "${protocol}".`);

  const data = await queryWithRetry<Raw>(deployment.id, PULSE_QUERY, undefined, 15000);
  if (!data?.governances?.length || !data.proposals?.length) {
    throw new NoAnswer(`No proposals indexed for "${protocol}".`);
  }

  const now = Date.now() / 1000;
  const g = data.governances[0];
  const proposals = data.proposals;
  const newest = Number(proposals[0].creationTime);
  const daysSinceLastProposal = Math.floor((now - newest) / DAY);

  if (daysSinceLastProposal > UNANSWERABLE_AFTER_DAYS) {
    throw new NoAnswer(
      `No proposal indexed for ${protocol} in ${ago(daysSinceLastProposal)}. Governance may be dormant or may have moved to a contract this subgraph does not watch; this source cannot tell which.`,
    );
  }

  const within = (days: number) => proposals.filter((p) => now - Number(p.creationTime) <= days * DAY).length;
  const proposalsLast90d = within(90);
  const proposalsLast365d = within(365);

  const proposalsTotal = Number(g.proposals);
  const executedTotal = Number(g.proposalsExecuted);
  const passRate = proposalsTotal > 0 ? executedTotal / proposalsTotal : null;

  // Turnout against quorum on the last five finished proposals.
  const finished = proposals.filter((p) => !["ACTIVE", "PENDING"].includes(p.state)).slice(0, 5);
  const ratios = finished
    .map((p) => {
      const quorum = Number(p.quorumVotes) || Number(data.governanceFrameworks?.[0]?.quorumVotes) || 0;
      const turnout = Number(p.forWeightedVotes) + Number(p.againstWeightedVotes);
      return quorum > 0 ? turnout / quorum : null;
    })
    .filter((x): x is number => x !== null);
  const turnoutVsQuorum = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : null;

  const pulse: GovernancePulseResult["pulse"] =
    daysSinceLastProposal <= 45 && proposalsLast90d >= 2
      ? "active"
      : daysSinceLastProposal <= QUIET_AFTER_DAYS
        ? "slow"
        : "quiet";

  const result: GovernancePulseResult = {
    protocol,
    daysSinceLastProposal,
    proposalsLast90d,
    proposalsLast365d,
    proposalsTotal,
    executedTotal,
    passRate,
    turnoutVsQuorum,
    lastState: proposals[0].state,
    pulse,
    assessment: "",
  };
  result.assessment = assess(result);
  return result;
}

function assess(r: GovernancePulseResult): string {
  const lines: string[] = [];
  const last =
    r.daysSinceLastProposal === 0 ? "today" : r.daysSinceLastProposal === 1 ? "yesterday" : `${r.daysSinceLastProposal} days ago`;

  if (r.pulse === "active") {
    lines.push(`${r.protocol} governance is active: ${r.proposalsLast90d} proposals in the last 90 days, the latest ${last}.`);
  } else if (r.pulse === "slow") {
    lines.push(`${r.protocol} governance is slow: ${r.proposalsLast365d} proposals in the last year, the latest ${last}.`);
  } else {
    lines.push(`${r.protocol} governance is quiet: nothing proposed in ${ago(r.daysSinceLastProposal)}.`);
  }

  if (r.passRate !== null) {
    lines.push(`${r.executedTotal} of ${r.proposalsTotal} proposals ever made were executed (${Math.round(r.passRate * 100)}%).`);
  }

  if (r.turnoutVsQuorum !== null) {
    if (r.turnoutVsQuorum >= 2) {
      lines.push(`Turnout on recent votes ran ${r.turnoutVsQuorum.toFixed(1)}x quorum; participation is not the constraint.`);
    } else if (r.turnoutVsQuorum >= 1) {
      lines.push(`Recent votes cleared quorum by ${((r.turnoutVsQuorum - 1) * 100).toFixed(0)}%, a thin margin.`);
    } else {
      lines.push(`Recent votes averaged ${(r.turnoutVsQuorum * 100).toFixed(0)}% of quorum; proposals are failing for lack of turnout, not opposition.`);
    }
  }

  return lines.join(" ");
}
