"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { InputField } from "@/lib/tools/registry";

type PlaygroundTool = {
  slug: string;
  name: string;
  price: string;
  summary: string;
  inputs: InputField[];
  example: Record<string, unknown>;
};

type Rail = { id: string; name: string; network: string };

type Line = { text: string; tone: "dim" | "warn" | "ok" | "key" | "error" };

type Result = {
  tool: string;
  ms: number;
  payment: {
    settled: boolean;
    network: string | null;
    payer: string | null;
    transaction: string | null;
    explorer: string | null;
  } | null;
  data: Record<string, unknown> | null;
};

export function Playground({
  tools,
  rails,
  initialSlug,
}: {
  tools: PlaygroundTool[];
  rails: Rail[];
  initialSlug?: string;
}) {
  const [slug, setSlug] = useState(initialSlug ?? tools[0]?.slug ?? "");
  const [network, setNetwork] = useState<string>(rails[0]?.network ?? "");
  const [values, setValues] = useState<Record<string, string>>({});
  const [lines, setLines] = useState<Line[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [running, setRunning] = useState(false);

  const tool = useMemo(() => tools.find((t) => t.slug === slug), [tools, slug]);

  // Switching tool resets the form to that tool's own example, so the run button is
  // always one click away from something that works.
  useEffect(() => {
    if (!tool) return;
    setValues(
      Object.fromEntries(tool.inputs.map((input) => [input.name, String(tool.example[input.name] ?? "")])),
    );
    setResult(null);
    setLines([]);
  }, [tool]);

  async function run() {
    if (!tool || running) return;

    setRunning(true);
    setResult(null);

    const railName = rails.find((rail) => rail.network === network)?.name ?? "first offered";
    const log: Line[] = [
      { text: `POST /api/tools/${tool.slug}`, tone: "key" },
      { text: `  ${JSON.stringify(values)}`, tone: "dim" },
      { text: "", tone: "dim" },
      { text: "← 402 Payment Required", tone: "warn" },
      { text: `  paying on ${railName} from the demo wallet…`, tone: "dim" },
    ];
    setLines(log);

    try {
      const response = await fetch("/api/playground", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: tool.slug, input: values, network: network || undefined }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setLines([...log, { text: "", tone: "dim" }, { text: `✗ ${payload.error}`, tone: "error" }]);
        return;
      }

      const settled: Line[] = payload.payment
        ? [
            {
              text: `  ↳ settled on ${payload.payment.network}`,
              tone: "dim",
            },
            { text: `  ↳ payer ${payload.payment.payer}`, tone: "dim" },
          ]
        : [{ text: "  ↳ no receipt reported", tone: "dim" }];

      setLines([
        ...log,
        ...settled,
        { text: "", tone: "dim" },
        { text: `← 200 OK in ${payload.ms} ms`, tone: "ok" },
      ]);
      setResult(payload as Result);
    } catch (error) {
      setLines([
        ...log,
        { text: "", tone: "dim" },
        { text: `✗ ${error instanceof Error ? error.message : "Request failed"}`, tone: "error" },
      ]);
    } finally {
      setRunning(false);
    }
  }

  const assessment =
    result?.data && typeof result.data.assessment === "string" ? result.data.assessment : null;

  return (
    <div className="pg">
      <div className="panel">
        <h2>Request</h2>
        <p className="hint">Pick a tool, adjust the arguments, run it.</p>

        <div className="form" style={{ marginTop: 18 }}>
          <div className="field">
            <label htmlFor="tool">Tool</label>
            <select id="tool" value={slug} onChange={(event) => setSlug(event.target.value)}>
              {tools.map((option) => (
                <option key={option.slug} value={option.slug}>
                  {option.name} · {option.price}
                </option>
              ))}
            </select>
            {tool && <span className="hint">{tool.summary}</span>}
          </div>

          {tool?.inputs.map((input) => (
            <div key={input.name} className="field">
              <label htmlFor={input.name}>{input.name}</label>
              {input.options ? (
                <select
                  id={input.name}
                  value={values[input.name] ?? ""}
                  onChange={(event) =>
                    setValues({ ...values, [input.name]: event.target.value })
                  }
                >
                  {input.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={input.name}
                  value={values[input.name] ?? ""}
                  onChange={(event) =>
                    setValues({ ...values, [input.name]: event.target.value })
                  }
                />
              )}
              <span className="hint">{input.description}</span>
            </div>
          ))}

          {rails.length > 1 && (
            <div className="field">
              <label htmlFor="network">Pay on</label>
              <select
                id="network"
                value={network}
                onChange={(event) => setNetwork(event.target.value)}
              >
                {rails.map((rail) => (
                  <option key={rail.network} value={rail.network}>
                    {rail.name}
                  </option>
                ))}
              </select>
              <span className="hint">Both rails are offered in the same 402.</span>
            </div>
          )}

          <button
            type="button"
            className="btn btn-primary"
            onClick={run}
            disabled={running || !tool}
          >
            {running ? "Paying…" : `Run and pay ${tool?.price ?? ""}`}
          </button>

          <p className="hint" style={{ margin: 0 }}>
            Funded by us so you do not need a wallet.{" "}
            <Link href="/connect" className="link">
              Connect your own agent
            </Link>{" "}
            to pay from yours.
          </p>
        </div>
      </div>

      <div className="log">
        <div className="terminal-bar">
          <span className="terminal-dot" />
          <span className="terminal-dot" />
          <span className="terminal-dot" />
          <span style={{ marginLeft: 6 }}>demo agent</span>
        </div>

        <pre className="log-body">
          {lines.length === 0
            ? "Nothing run yet. Press the button and watch the 402 turn into an answer."
            : lines.map((line, index) => (
                <span
                  key={index}
                  className={`log-line ${
                    line.tone === "ok"
                      ? "t-ok"
                      : line.tone === "warn"
                        ? "t-warn"
                        : line.tone === "key"
                          ? "t-key"
                          : line.tone === "error"
                            ? "t-warn"
                            : "t-dim"
                  }`}
                >
                  {line.text || " "}
                </span>
              ))}
        </pre>

        {result && (
          <div className="answer">
            {assessment ? (
              <div className="quote">{assessment}</div>
            ) : (
              <pre className="code" style={{ maxHeight: 220, overflow: "auto" }}>
                {JSON.stringify(result.data, null, 2)}
              </pre>
            )}

            {/* Hedera settles to a transaction an explorer can show. Circle Gateway
                returns a transfer id instead, so that is shown as-is rather than
                linked somewhere it would not resolve. */}
            {result.payment?.explorer ? (
              <p style={{ margin: "14px 0 0", fontSize: 13 }}>
                <a
                  href={result.payment.explorer}
                  target="_blank"
                  rel="noreferrer"
                  className="link"
                >
                  View the payment on the explorer →
                </a>
              </p>
            ) : (
              result.payment?.transaction && (
                <p
                  style={{
                    margin: "14px 0 0",
                    fontSize: 12,
                    color: "var(--text-3)",
                    fontFamily: "var(--mono)",
                    overflowWrap: "anywhere",
                  }}
                >
                  gateway transfer {result.payment.transaction}
                </p>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
