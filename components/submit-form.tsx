"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Code } from "@/components/code";
import { Select } from "@/components/select";

const REPO = "https://github.com/web3xDev/onchain-router";

type Fields = {
  endpoint: string;
  example: string;
  name: string;
  category: string;
  question: string;
  inputs: string;
  contact: string;
};

const EMPTY: Fields = {
  endpoint: "",
  example: '{ "asset": "USDC", "chain": "base" }',
  name: "",
  category: "",
  question: "",
  inputs: "",
  contact: "",
};

type Accept = { network: string | null; amount: string | null; asset: string | null; payTo: string | null };
type Probe =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "ok"; accepts: Accept[]; description: string | null }
  | { state: "bad"; error: string };

type Start = "api" | "x402";
type Active = "start" | "verify" | "describe" | "submit";

/** A rail as the 402 names it, rendered the way the site names it. */
function railLabel(a: Accept): { name: string; price: string } {
  const n = Number(a.amount ?? 0);
  const trim = (x: number) => x.toFixed(4).replace(/\.?0+$/, "");
  if (a.network === "hedera:testnet") return { name: "Hedera Testnet", price: `${trim(n / 1e8)} HBAR` };
  if (a.network === "eip155:5042002") return { name: "Arc Testnet", price: `${trim(n / 1e6)} USDC` };
  return { name: a.network ?? "unknown", price: `${a.amount} of ${a.asset}` };
}

function shorten(address: string | null): string {
  if (!address) return "?";
  return address.startsWith("0x") && address.length > 14
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : address;
}

/**
 * Lists a tool in three steps: get to a 402, describe it, submit for review.
 *
 * The router never asks for a price or a payout address: both are in the endpoint's
 * own 402, which Check reads live. The form collects only what the catalogue shows.
 * A submission is a prefilled GitHub issue, so review happens in public and nothing
 * is stored here.
 */
export function SubmitForm({ categories }: { categories: string[] }) {
  const [start, setStart] = useState<Start>("api");
  const [active, setActive] = useState<Active | null>("start");
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [touched, setTouched] = useState(false);
  const [probe, setProbe] = useState<Probe>({ state: "idle" });

  const missing = (["endpoint", "name", "question"] as const).filter((key) => !fields[key].trim());
  const ready = probe.state === "ok" && missing.length === 0;

  const set = (key: keyof Fields) => (event: { target: { value: string } }) => {
    setFields((current) => ({ ...current, [key]: event.target.value }));
    if (key === "endpoint" || key === "example") setProbe({ state: "idle" });
  };

  function sampleInput(): Record<string, unknown> | null {
    try {
      const parsed = JSON.parse(fields.example || "{}");
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }

  async function check() {
    if (!fields.endpoint.trim()) return;
    const input = sampleInput();
    if (input === null) {
      setProbe({ state: "bad", error: "The example request is not valid JSON." });
      return;
    }

    setProbe({ state: "checking" });
    try {
      const response = await fetch("/api/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: fields.endpoint.trim(), input }),
      });
      const result = await response.json();
      setProbe(
        result.ok
          ? { state: "ok", accepts: result.accepts, description: result.description }
          : { state: "bad", error: result.error ?? "Check failed." },
      );
    } catch (error) {
      setProbe({ state: "bad", error: error instanceof Error ? error.message : "Check failed." });
    }
  }

  function submit() {
    setTouched(true);
    if (!ready || probe.state !== "ok") return;

    const rails = probe.accepts
      .map((a) => `- ${a.network}: ${a.amount} of ${a.asset} to ${a.payTo}`)
      .join("\n");

    const body = [
      `**Endpoint**: ${fields.endpoint.trim()}`,
      "",
      "**402 as read by the router**",
      rails,
      "",
      `**Name**: ${fields.name}`,
      `**Category**: ${fields.category || "(new category)"}`,
      "",
      "**What it answers**",
      fields.question,
      "",
      "**Inputs**",
      fields.inputs || "(as in the example request)",
      "",
      "**Example request**",
      "```json",
      fields.example,
      "```",
      "",
      `**Contact**: ${fields.contact || "not stated"}`,
    ].join("\n");

    const url =
      `${REPO}/issues/new?title=${encodeURIComponent(`List: ${fields.name}`)}` +
      `&body=${encodeURIComponent(body)}`;

    window.open(url, "_blank", "noreferrer");
  }

  const hostOf = (url: string) => {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  };

  const verifySummary =
    probe.state === "ok"
      ? `${hostOf(fields.endpoint)} · ${probe.accepts.map((a) => railLabel(a).price).join(" · ")}`
      : probe.state === "checking"
        ? "Checking…"
        : "";

  const describeSummary = fields.name.trim() ? fields.name.trim() : "";

  type Step = { id: Active; no: string; title: string; summary: string; done: boolean; locked?: boolean };
  const steps: Step[] = [
    {
      id: "start",
      no: "00",
      title: "How do you want to start?",
      summary: start === "api" ? "I have an API" : "I already use x402",
      done: active !== "start",
    },
    { id: "verify", no: "01", title: "Verify your endpoint", summary: verifySummary, done: probe.state === "ok" },
    { id: "describe", no: "02", title: "Describe your tool", summary: describeSummary, done: missing.length === 0 && probe.state === "ok" },
    { id: "submit", no: "03", title: "Submit for review", summary: "", done: false, locked: probe.state !== "ok" },
  ];

  // Opening a lower step collapses the one above it, which would yank the clicked
  // header up the screen. The header's position is measured before the change and
  // restored after the render, so what you clicked stays under your cursor.
  const heads = useRef<Record<string, HTMLButtonElement | null>>({});
  const anchor = useRef<{ id: Active; top: number } | null>(null);

  // Continue: the next step opens and its header is brought just under the nav,
  // since the button that was pressed sat at the bottom of the previous one.
  const openStep = (id: Active) => {
    anchor.current = { id, top: 84 };
    setActive(id);
  };

  const toggleStep = (id: Active) => {
    const head = heads.current[id];
    if (head) anchor.current = { id, top: head.getBoundingClientRect().top };
    setActive((current) => (current === id ? null : id));
  };

  useLayoutEffect(() => {
    const a = anchor.current;
    if (!a) return;
    anchor.current = null;
    const head = heads.current[a.id];
    if (!head) return;
    // The heights animate, so the correction runs every frame until they settle.
    const until = performance.now() + 300;
    let frame = 0;
    const follow = () => {
      const delta = head.getBoundingClientRect().top - a.top;
      if (Math.abs(delta) >= 0.5) window.scrollBy(0, delta);
      if (performance.now() < until) frame = requestAnimationFrame(follow);
    };
    follow();
    return () => cancelAnimationFrame(frame);
  }, [active]);

  return (
    <div className="submit">
      {steps.map((step) => {
        const isOpen = active === step.id;
        return (
          <section key={step.id} className={`acc${isOpen ? " is-open" : ""}${step.done ? " is-done" : ""}`}>
            <button
              type="button"
              className="acc-head"
              ref={(el) => {
                heads.current[step.id] = el;
              }}
              onClick={() => !step.locked && toggleStep(step.id)}
              aria-expanded={isOpen}
              disabled={step.locked}
            >
              <span className="step-no">{step.no}</span>
              <span className="acc-title">{step.title}</span>
              {!isOpen && step.summary && (
                <span className="acc-summary">
                  {step.done && <span className="probe-tick">✓ </span>}
                  {step.summary}
                </span>
              )}
              {step.locked && !isOpen && <span className="acc-summary">After Check</span>}
              <span className="acc-chev" aria-hidden="true" />
            </button>

            <div className="acc-wrap" inert={!isOpen}>
            <div className="acc-clip">
            {step.id === "start" && (
              <div className="acc-body">
                <div className="start-cards" role="radiogroup" aria-label="How do you want to start">
                  <button type="button" role="radio" aria-checked={start === "api"} className="start-card" onClick={() => setStart("api")}>
                    <span className="start-title">I have an API</span>
                    <span className="start-sub">Add pay-per-call payments in one function call.</span>
                    <span className="start-flag">Recommended</span>
                  </button>
                  <button type="button" role="radio" aria-checked={start === "x402"} className="start-card" onClick={() => setStart("x402")}>
                    <span className="start-title">I already use x402</span>
                    <span className="start-sub">Bring your existing endpoint.</span>
                  </button>
                </div>

                {start === "api" ? (
                  <div className="start-body">
                    <p>
                      <code>paid()</code> adds x402 to your existing handler. Your price and wallet
                      go out in the 402; successful calls settle directly to you.
                    </p>
                    <div style={{ marginBottom: 10 }}>
                      <Code lang="sh">{`npm install onchainrouter`}</Code>
                    </div>
                    <Code lang="ts">
                      {`import { paid } from "onchainrouter/server";

export const POST = paid(
  {
    price: { hbar: "0.1", usdc: "0.01" },
    payTo: { hedera: "0.0.12345", arc: "0xYourAddress" },
  },
  async (input) => {
    const result = await yourExistingLogic(input);
    if (!result) return null;   // no answer, no charge
    return result;
  },
);`}
                    </Code>
                    <p className="hint" style={{ marginTop: 10 }}>
                      A complete Next.js route, and a plain <code>(Request) =&gt; Response</code>{" "}
                      for Hono, Bun, Workers or Express. Deploy it, then continue.
                    </p>
                  </div>
                ) : (
                  <div className="start-body">
                    <p>
                      Your endpoint answers 402 on Hedera or Arc. The router relays that 402 to
                      callers and their signed payment back to you. Settlement happens at your
                      endpoint; nothing changes on your side.
                    </p>
                  </div>
                )}

                <button type="button" className="btn btn-primary" onClick={() => openStep("verify")} style={{ marginTop: 18 }}>
                  Continue
                </button>
              </div>
            )}

            {step.id === "verify" && (
              <div className="acc-body">
                <div className="field">
                  <div className="probe-row">
                    <input
                      id="endpoint"
                      aria-label="x402 endpoint"
                      value={fields.endpoint}
                      onChange={set("endpoint")}
                      placeholder="https://api.example.com/liquidation-risk"
                      onKeyDown={(e) => e.key === "Enter" && check()}
                    />
                    <button type="button" className="btn" onClick={check} disabled={probe.state === "checking" || !fields.endpoint.trim()}>
                      {probe.state === "checking" ? "Checking…" : "Check"}
                    </button>
                  </div>
                  <span className="hint">
                    We read the price, payment rails and payout address straight from your 402.
                    POST, JSON body.
                  </span>
                </div>

                {probe.state === "bad" && <div className="probe-result probe-bad">{probe.error}</div>}

                {probe.state === "ok" && (
                  <div className="probe-result probe-ok">
                    <div className="probe-title">
                      <span className="probe-tick">✓</span> Speaks x402
                      <span className="probe-count">
                        {probe.accepts.length} payment rail{probe.accepts.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="probe-rails">
                      {probe.accepts.map((a, i) => {
                        const { name, price } = railLabel(a);
                        return (
                          <div key={i} className="probe-rail" style={{ animationDelay: `${120 + i * 110}ms` }}>
                            <span className="probe-rail-name">{name}</span>
                            <span className="probe-rail-price">{price}</span>
                            <span className="probe-rail-to" title={a.payTo ?? ""}>→ {shorten(a.payTo)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <details className="acc-more" style={{ marginTop: 12 }}>
                  <summary>Example request</summary>
                  <div className="field" style={{ marginTop: 8 }}>
                    <textarea id="example" value={fields.example} onChange={set("example")} style={{ minHeight: 56, fontFamily: "var(--mono)", fontSize: 13 }} />
                    <span className="hint">Sent as the body when checking; shown on the tool page.</span>
                  </div>
                </details>

                <button type="button" className="btn btn-primary" onClick={() => openStep("describe")} disabled={probe.state !== "ok"} style={{ marginTop: 18 }}>
                  Continue
                </button>
              </div>
            )}

            {step.id === "describe" && (
              <div className="acc-body">
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="name">Tool name</label>
                    <input id="name" value={fields.name} onChange={set("name")} placeholder="Liquidation risk" />
                    {touched && !fields.name.trim() && <span className="error">Required</span>}
                  </div>
                  <div className="field">
                    <label htmlFor="category">Category</label>
                    <Select
                      id="category"
                      value={fields.category}
                      onChange={(value) => set("category")({ target: { value } })}
                      placeholder="Choose or leave blank for a new one"
                      options={[{ value: "", label: "New category" }, ...categories.map((c) => ({ value: c, label: c }))]}
                    />
                  </div>
                  <div className="field span-2">
                    <label htmlFor="question">What it answers</label>
                    <textarea id="question" value={fields.question} onChange={set("question")} placeholder="How close is this position to liquidation, and what price move gets it there?" style={{ minHeight: 56 }} />
                    <span className="hint">One sentence, shown on the catalogue card.</span>
                    {touched && !fields.question.trim() && <span className="error">Required</span>}
                  </div>
                  <div className="field">
                    <label htmlFor="inputs">Inputs</label>
                    <textarea id="inputs" value={fields.inputs} onChange={set("inputs")} placeholder={"address: the position owner\nchain: ethereum | base | arbitrum"} style={{ minHeight: 72, fontFamily: "var(--mono)", fontSize: 13 }} />
                    <span className="hint">One per line. Fixed choices as a | b | c.</span>
                  </div>
                  <div className="field">
                    <label htmlFor="contact">Contact</label>
                    <input id="contact" value={fields.contact} onChange={set("contact")} placeholder="GitHub handle or X" />
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setTouched(true);
                    if (missing.length === 0) openStep("submit");
                  }}
                  style={{ marginTop: 18 }}
                >
                  Continue
                </button>
              </div>
            )}

            {step.id === "submit" && (
              <div className="acc-body">
                <p style={{ margin: "0 0 14px", color: "var(--text-2)" }}>
                  Opens a prefilled GitHub issue with everything we read from your 402. We review
                  it, then your tool is live in the catalogue and over MCP.
                </p>
                <div className="submit-chips" style={{ marginBottom: 18 }}>
                  <span>0% commission</span>
                  <span>Direct settlement</span>
                  <span>MCP + HTTP</span>
                </div>
                <button type="button" className="btn btn-primary" onClick={submit} disabled={!ready}>
                  Submit listing request
                </button>
              </div>
            )}
            </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
