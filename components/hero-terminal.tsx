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

type Line = { text: string; tone: "dim" | "warn" | "ok" | "key"; group: number };

function script(rail: RailId): Line[] {
  const current = RAILS[rail];
  // Grouped the way the exchange actually happens: request, 402, signing, answer.
  return [
    { text: "$ POST /api/tools/lending-rates", tone: "key", group: 0 },
    { text: '  { "asset": "USDC", "chain": "ethereum" }', tone: "dim", group: 0 },
    { text: "", tone: "dim", group: 0 },
    { text: "← 402 Payment Required", tone: "warn", group: 1 },
    { text: "  accepts: hedera:testnet, eip155:5042002", tone: "dim", group: 1 },
    { text: "", tone: "dim", group: 1 },
    { text: "  agent signs from its own wallet", tone: "dim", group: 2 },
    { text: `  ↳ ${current.settled}`, tone: "dim", group: 2 },
    { text: `    ${current.via}`, tone: "dim", group: 2 },
    { text: "", tone: "dim", group: 2 },
    { text: "← 200 OK", tone: "ok", group: 3 },
    { text: '  "Best supply rate: 4.51% on compound-v3,', tone: "key", group: 3 },
    { text: "   backed by $376.0M of liquidity.", tone: "key", group: 3 },
    { text: "   iron-bank reports 75.10%, stale data", tone: "key", group: 3 },
    { text: "   from an abandoned protocol,", tone: "key", group: 3 },
    { text: '   not an offer."', tone: "key", group: 3 },
  ];
}

/** Each step lands as a block, a beat apart, the way it does in the playground. */
const STEP_MS = 295;

export function HeroTerminal() {
  const [rail, setRail] = useState<RailId>("hedera");

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

      {/* Keyed on the rail so a switch remounts the lines and replays the entrance. */}
      <pre className="terminal-body" key={rail}>
        {script(rail).map((line, index) => (
          <span
            key={index}
            className={`log-line t-${line.tone}`}
            style={{ animationDelay: `${line.group * STEP_MS}ms` }}
          >
            {line.text || " "}
          </span>
        ))}
      </pre>
    </div>
  );
}
