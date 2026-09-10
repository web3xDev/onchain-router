import { querySubgraph } from "@/lib/graph/client";
import { GOVERNANCE_DEPLOYMENTS, GOVERNANCE_PROTOCOLS } from "@/lib/graph/deployments";
import { NoAnswer } from "@/lib/tools/no-answer";

/**
 * Who actually controls a protocol?
 *
 * A governance page shows a list of delegates and their voting power. That list does
 * not answer the question an agent is asking before it commits capital: could a small
 * group pass whatever they like, and is the power that exists even awake?
 *
 * Both answers come from comparing the delegate table against the protocol's own
 * quorum, which is why they are computed here rather than returned as rows.
 */

const GOVERNANCE_QUERY = `
  query Governance {
    governances {
      totalTokenSupply
      currentTokenHolders
      currentDelegates
      delegatedVotes
      proposals
      proposalsExecuted
    }
    governanceFrameworks {
      name
      type
      quorumVotes
    }
    delegates(first: 25, orderBy: delegatedVotesRaw, orderDirection: desc) {
      id
      delegatedVotes
      numberVotes
      tokenHoldersRepresentedAmount
    }
  }
`;

type RawGovernance = {
  governances: {
    totalTokenSupply: string;
    currentTokenHolders: string;
    currentDelegates: string;
    delegatedVotes: string;
    proposals: string;
    proposalsExecuted: string;
  }[];
  governanceFrameworks: { name: string; type: string; quorumVotes: string }[];
  delegates: {
    id: string;
    delegatedVotes: string;
    numberVotes: string;
    tokenHoldersRepresentedAmount: string;
  }[];
};

export type TopDelegate = {
  address: string;
  votes: number;
  shareOfDelegated: number;
  timesVoted: number;
  representing: number;
  dormant: boolean;
};

export type GovernancePowerResult = {
  protocol: string;
  framework: string | null;
  tokenHolders: number;
  delegates: number;
  proposals: number;
  proposalsExecuted: number;
  quorumVotes: number | null;
  /** How many of the largest delegates, acting together, reach quorum. */
  delegatesToQuorum: number | null;
  top10Share: number;
  dormantShare: number;
  assessment: string;
  topDelegates: TopDelegate[];
};

/** A delegate holding meaningful power that has never cast a vote. */
const DORMANT_MIN_SHARE = 0.01;

export async function governancePower(protocolInput: string): Promise<GovernancePowerResult> {
  const protocol = protocolInput.trim().toLowerCase();
  const deployment = GOVERNANCE_DEPLOYMENTS.find((d) => d.protocol === protocol);

  if (!deployment) {
    throw new Error(`Unknown protocol "${protocol}". Known: ${GOVERNANCE_PROTOCOLS.join(", ")}`);
  }

  const data = await querySubgraph<RawGovernance>(deployment.id, GOVERNANCE_QUERY, undefined, 15000);
  if (!data?.governances?.length) {
    throw new NoAnswer(`No governance data available for "${protocol}". The subgraph is not currently served.`);
  }

  const g = data.governances[0];
  const framework = data.governanceFrameworks?.[0] ?? null;
  const quorum = framework ? Number(framework.quorumVotes) / 1e18 : null;
  const totalDelegated = Number(g.delegatedVotes);

  const delegates: TopDelegate[] = data.delegates.map((d) => {
    const votes = Number(d.delegatedVotes);
    const share = totalDelegated > 0 ? votes / totalDelegated : 0;
    return {
      address: d.id,
      votes,
      shareOfDelegated: share,
      timesVoted: Number(d.numberVotes),
      representing: Number(d.tokenHoldersRepresentedAmount),
      dormant: Number(d.numberVotes) === 0 && share >= DORMANT_MIN_SHARE,
    };
  });

  // How few of the largest delegates could carry a vote between them.
  let delegatesToQuorum: number | null = null;
  if (quorum && quorum > 0) {
    let running = 0;
    for (const [index, d] of delegates.entries()) {
      running += d.votes;
      if (running >= quorum) {
        delegatesToQuorum = index + 1;
        break;
      }
    }
  }

  // Everything reported about "the largest delegates" is measured over the same ten,
  // so the numbers in the sentence and the numbers in the table describe one group.
  const topTen = delegates.slice(0, 10);
  const top10Share = topTen.reduce((sum, d) => sum + d.shareOfDelegated, 0);
  const dormantShare = topTen.filter((d) => d.dormant).reduce((sum, d) => sum + d.shareOfDelegated, 0);

  return {
    protocol,
    framework: framework?.name ?? null,
    tokenHolders: Number(g.currentTokenHolders),
    delegates: Number(g.currentDelegates),
    proposals: Number(g.proposals),
    proposalsExecuted: Number(g.proposalsExecuted),
    quorumVotes: quorum,
    delegatesToQuorum,
    top10Share,
    dormantShare,
    assessment: assess(protocol, delegatesToQuorum, top10Share, dormantShare, topTen, delegates.length),
    topDelegates: topTen,
  };
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function assess(
  protocol: string,
  toQuorum: number | null,
  top10Share: number,
  dormantShare: number,
  topTen: TopDelegate[],
  examined: number,
): string {
  const lines: string[] = [];

  if (toQuorum === null) {
    lines.push(`Quorum is not published on chain for ${protocol}, so capture cannot be measured directly.`);
  } else if (toQuorum === 1) {
    // "1 delegate acting together" reads as a bug even when the number is right.
    lines.push(
      `The largest delegate reaches quorum alone. This protocol can be governed by a single address.`,
    );
  } else if (toQuorum <= 3) {
    lines.push(
      `${toQuorum} delegates acting together reach quorum. Governance is effectively controlled by a handful of addresses.`,
    );
  } else if (toQuorum <= 10) {
    lines.push(`${toQuorum} delegates acting together reach quorum: concentrated, but not captured by two or three.`);
  } else {
    lines.push(`It takes more than ${examined} of the largest delegates to reach quorum on their own.`);
  }

  lines.push(`The ten largest delegates hold ${pct(top10Share)} of delegated votes.`);

  const dormant = topTen.filter((d) => d.dormant);
  if (dormant.length > 0) {
    lines.push(
      dormant.length === 1
        ? `One of them has never cast a vote, holding ${pct(dormantShare)} on its own, power that exists on paper but has never moved.`
        : `${dormant.length} of them have never cast a vote, holding ${pct(dormantShare)} between them, power that exists on paper but has never moved.`,
    );
  }

  return lines.join(" ");
}
