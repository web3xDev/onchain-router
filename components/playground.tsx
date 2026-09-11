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

type Line = { text: string; tone: "dim" | "warn" | "ok" | "key" | "error"; pending?: boolean };

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

    // Lines are appended as events arrive from the server. The last line carries a
    // spinner while its step is in progress and is replaced when the step completes.
    let log: Line[] = [];
    const show = (next: Line[]) => {
      log = next;
      setLines(next);
    };
    const push = (line: Line) => show([...log, line]);
    const settle = (line: Line) => show([...log.filter((l) => !l.pending), line]);

    push({ text: `POST /api/tools/${tool.slug}`, tone: "key" });
    push({ text: `  ${JSON.stringify(values)}`, tone: "dim" });
    push({ text: "  waiting for the router…", tone: "dim", pending: true });

    const answer: { payment: Result["payment"]; data: Result["data"]; ms: number } = {
      payment: null,
      data: null,
      ms: 0,
    };

    try {
      const response = await fetch("/api/playground", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: tool.slug, input: values, network: network || undefined }),
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        settle({ text: `✗ ${payload.error}`, tone: "error" });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const handle = (event: Record<string, unknown>) => {
        const at = `${event.t} ms`;
        switch (event.type) {
          case "quote": {
            const networks = (event.networks as string[]).join(", ");
            settle({ text: "", tone: "dim" });
            push({ text: `← 402 Payment Required   ${at}`, tone: "warn" });
            push({ text: `  accepts: ${networks}`, tone: "dim" });
            push({ text: `  signing on ${event.chosen} from the demo wallet…`, tone: "dim", pending: true });
            break;
          }
          case "signed":
            settle({ text: `  ↳ signed, ${event.amount} on ${event.network}   ${at}`, tone: "dim" });
            push({ text: "  paid request sent, tool running…", tone: "dim", pending: true });
            break;
          case "settled":
            answer.payment = {
              settled: Boolean(event.settled),
              network: (event.network as string) ?? null,
              payer: (event.payer as string) ?? null,
              transaction: (event.transaction as string) ?? null,
              explorer: (event.explorer as string) ?? null,
            };
            settle({ text: `  ↳ settled on ${event.network} by ${event.payer}   ${at}`, tone: "dim" });
            break;
          case "answer":
            answer.data = event.data as Result["data"];
            answer.ms = Number(event.ms);
            settle({ text: "", tone: "dim" });
            push({ text: `← 200 OK in ${answer.ms} ms`, tone: "ok" });
            setResult({ tool: tool.slug, ms: answer.ms, payment: answer.payment, data: answer.data });
            break;
          case "no-answer":
            settle({ text: "", tone: "dim" });
            push({ text: `← no answer, nothing charged   ${at}`, tone: "warn" });
            push({ text: `  ${event.error}`, tone: "dim" });
            break;
          case "error":
            settle({ text: "", tone: "dim" });
            push({ text: `✗ ${event.error}`, tone: "error" });
            break;
        }
      };

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newline: number;
        while ((newline = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (line) handle(JSON.parse(line));
        }
      }
    } catch (error) {
      settle({ text: `✗ ${error instanceof Error ? error.message : "Request failed"}`, tone: "error" });
    } finally {
      show(log.filter((l) => !l.pending));
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
            <span className="select">
            <select id="tool" value={slug} onChange={(event) => setSlug(event.target.value)}>
              {tools.map((option) => (
                <option key={option.slug} value={option.slug}>
                  {option.name} · {option.price}
                </option>
              ))}
            </select>
            </span>
            {tool && <span className="hint">{tool.summary}</span>}
          </div>

          {tool?.inputs.map((input) => (
            <div key={input.name} className="field">
              <label htmlFor={input.name}>{input.name}</label>
              {input.options ? (
                <span className="select">
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
                </span>
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
              <span className="select">
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
              </span>
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
            Funded by us so you do not need a wallet.
            <br />
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
                  {line.pending && <span className="spin" aria-hidden="true" />}
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
