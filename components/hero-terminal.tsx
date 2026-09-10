"use client";

import { useState } from "react";

type RailId = "hedera" | "arc";

/**
 * The same call, settled on either rail. Only the settlement line changes: the
 * request, the 402 and the answer are identical, which is the point being made.
 */
const RAILS: Record<RailId, { label: string; settled: string; via: string }> = {
  hedera: {
    label: "Hedera",
    settled: "settled 0.1 HBAR on hedera:testnet",
    via: "via Blocky402, gas sponsored",
  },
  arc: {
    label: "Arc",
    settled: "settled 0.01 USDC on eip155:5042002",
    via: "via Circle Gateway, gasless",
  },
};

export function HeroTerminal() {
  const [rail, setRail] = useState<RailId>("hedera");
  const current = RAILS[rail];

  return (
    <div className="terminal">
      <div className="terminal-bar">
        <span className="terminal-dot" />
        <span className="terminal-dot" />
        <span className="terminal-dot" />
        <span style={{ marginLeft: 6 }}>agent · lending-rates</span>

        <div className="terminal-tabs">
          {(Object.keys(RAILS) as RailId[]).map((id) => (
            <button
              key={id}
              type="button"
              className="terminal-tab"
              aria-pressed={rail === id}
              onClick={() => setRail(id)}
            >
              {RAILS[id].label}
            </button>
          ))}
        </div>
      </div>

      <pre className="terminal-body">
        <span className="t-dim">$ </span>
        <span className="t-key">POST /api/tools/lending-rates</span>
        {"\n"}
        <span className="t-dim">{'  { "asset": "USDC", "chain": "ethereum" }'}</span>
        {"\n\n"}
        <span className="t-warn">← 402 Payment Required</span>
        {"\n"}
        <span className="t-dim">{"  accepts: hedera:testnet, eip155:5042002"}</span>
        {"\n\n"}
        <span className="t-dim">{"  agent signs from its own wallet"}</span>
        {"\n"}
        <span className="t-dim">{`  ↳ ${current.settled}`}</span>
        {"\n"}
        <span className="t-dim">{`    ${current.via}`}</span>
        {"\n\n"}
        <span className="t-ok">← 200 OK</span>
        {"\n"}
        <span className="t-key">
          {'  "Best supply rate: 4.51% on compound-v3,\n   backed by $376.0M of liquidity.'}
        </span>
        {"\n"}
        <span className="t-key">
          {'   iron-bank reports 75.10%, stale data\n   from an abandoned protocol,'}
        </span>
        {"\n"}
        <span className="t-key">{'   not an offer."'}</span>
      </pre>
    </div>
  );
}
