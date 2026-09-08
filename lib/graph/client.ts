const GATEWAY = "https://gateway.thegraph.com/api/subgraphs/id";

/**
 * Queries a subgraph on The Graph's decentralized network.
 *
 * Returns null rather than throwing: a fan-out across dozens of deployments will
 * always include some that are unindexed or erroring, and one bad indexer should not
 * take down an answer the rest of the network can still give.
 */
export async function querySubgraph<T>(
  subgraphId: string,
  query: string,
  variables?: Record<string, unknown>,
  timeoutMs = 8000,
): Promise<T | null> {
  const apiKey = process.env.GRAPH_API_KEY;
  if (!apiKey) throw new Error("GRAPH_API_KEY is not set");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${GATEWAY}/${subgraphId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const body = (await response.json()) as { data?: T; errors?: unknown[] };
    if (body.errors?.length) return null;

    return body.data ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type FanOutResult<T> = { protocol: string; data: T };

/** Runs the same query against many deployments at once. Failures are dropped. */
export async function fanOut<T>(
  deployments: { protocol: string; id: string }[],
  query: string,
  variables?: Record<string, unknown>,
): Promise<FanOutResult<T>[]> {
  const settled = await Promise.all(
    deployments.map(async (d): Promise<FanOutResult<T> | null> => {
      const data = await querySubgraph<T>(d.id, query, variables);
      return data === null ? null : { protocol: d.protocol, data: data as T };
    }),
  );

  return settled.filter((r): r is FanOutResult<T> => r !== null);
}
