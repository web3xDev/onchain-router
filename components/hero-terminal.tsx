"use client";

type Tone = "label" | "key" | "dim" | "warn" | "ok";
type Line = { text: string; tone: Tone; group: number; icon?: "user" | "agent" };

/** Small line icons, drawn with strokes so they sit at text weight. */
const ICONS = {
  user: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  ),
  agent: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="8" width="16" height="12" rx="2" />
      <path d="M12 8V4M8 4h8" />
      <circle cx="9" cy="14" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="14" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
};

/**
 * The whole product in one exchange: a question, an agent, a payment, an answer.
 *
 * Deliberately free of rails, facilitators and network ids. Those are true and they
 * live on the tool pages; the hero's job is to show that the loop closes.
 */
const SCRIPT: Line[] = [
  { text: "You", tone: "label", group: 0, icon: "user" },
  { text: "Where should I lend USDC?", tone: "key", group: 0 },
  { text: "", tone: "dim", group: 0 },
  { text: "Agent", tone: "label", group: 1, icon: "agent" },
  { text: '→ lending_rates("USDC", "ethereum")', tone: "dim", group: 1 },
  { text: "", tone: "dim", group: 1 },
  { text: "402 Payment Required", tone: "warn", group: 2 },
  { text: "→ $0.01", tone: "dim", group: 2 },
  { text: "", tone: "dim", group: 2 },
  { text: "Payment signed", tone: "dim", group: 3 },
  { text: "Payment settled", tone: "ok", group: 3 },
  { text: "200 OK", tone: "ok", group: 4 },
  { text: "", tone: "dim", group: 4 },
  { text: "Compound V3", tone: "key", group: 5 },
  { text: "4.51% supply APY", tone: "key", group: 5 },
  { text: "$376M liquidity", tone: "dim", group: 5 },
];

/** Each step lands as a block, a beat apart; the whole exchange takes about a second. */
const STEP_MS = 155;

export function HeroTerminal() {
  return (
    <div>
      <div className="terminal">
        <div className="terminal-bar">
          <span className="terminal-dot" />
          <span className="terminal-dot" />
          <span className="terminal-dot" />
          <span style={{ marginLeft: 6 }}>agent</span>
        </div>

        <pre className="terminal-body">
          {SCRIPT.map((line, index) => (
            <span
              key={index}
              className={`log-line t-${line.tone}`}
              style={{ animationDelay: `${line.group * STEP_MS}ms` }}
            >
              {line.icon && <span className="t-icon">{ICONS[line.icon]}</span>}
              {line.text || " "}
            </span>
          ))}
        </pre>
      </div>

      <p className="terminal-foot">Paid on Hedera or Arc, from the agent&apos;s own wallet.</p>
    </div>
  );
}
