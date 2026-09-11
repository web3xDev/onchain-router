"use client";

import { useState } from "react";
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

/**
 * Lists an x402 endpoint that already exists.
 *
 * The router does not need a price or a payout address: both are in the endpoint's
 * own 402, which the Check button reads live. What the form collects is what the
 * catalogue shows. Submissions go to the repo's issue tracker, prefilled, so review
 * happens in public and nothing is stored here.
 */
export function SubmitForm({ categories }: { categories: string[] }) {
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [touched, setTouched] = useState(false);
  const [probe, setProbe] = useState<Probe>({ state: "idle" });

  const missing = (["endpoint", "name", "question"] as const).filter((key) => !fields[key].trim());

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

  function open() {
    setTouched(true);
    if (missing.length > 0 || probe.state !== "ok") return;

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

  return (
    <div className="form">
      <div className="field">
        <label htmlFor="endpoint">x402 endpoint</label>
        <div className="probe-row">
          <input
            id="endpoint"
            value={fields.endpoint}
            onChange={set("endpoint")}
            placeholder="https://api.example.com/liquidation-risk"
          />
          <button
            type="button"
            className="btn"
            onClick={check}
            disabled={probe.state === "checking" || !fields.endpoint.trim()}
          >
            {probe.state === "checking" ? "Checking…" : "Check"}
          </button>
        </div>
        <span className="hint">
          POST, JSON body, answers 402 with x402 payment requirements on Hedera or Arc.
          Price and payout are read from that 402; you do not enter them.
        </span>
        {touched && !fields.endpoint.trim() && <span className="error">Required</span>}
        {touched && fields.endpoint.trim() && probe.state !== "ok" && (
          <span className="error">Run Check first; the endpoint has to answer 402.</span>
        )}
      </div>

      {probe.state === "bad" && <div className="probe-result probe-bad">{probe.error}</div>}

      {probe.state === "ok" && (
        <div className="probe-result probe-ok">
          <div className="probe-title">Speaks x402</div>
          {probe.accepts.map((a, index) => (
            <div key={index} className="probe-line">
              <span>{a.network}</span>
              <span>
                {a.amount} of {a.asset}
              </span>
              <span>→ {a.payTo}</span>
            </div>
          ))}
        </div>
      )}

      <div className="field">
        <label htmlFor="example">Example request</label>
        <textarea
          id="example"
          value={fields.example}
          onChange={set("example")}
          style={{ minHeight: 64, fontFamily: "var(--mono)", fontSize: 13 }}
        />
        <span className="hint">Sent as the body when checking, and shown on the tool page.</span>
      </div>

      <div className="two-up">
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
            options={[
              { value: "", label: "New category" },
              ...categories.map((category) => ({ value: category, label: category })),
            ]}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="question">What it answers</label>
        <textarea
          id="question"
          value={fields.question}
          onChange={set("question")}
          placeholder="How close is this position to liquidation, and what price move gets it there?"
          style={{ minHeight: 80 }}
        />
        <span className="hint">One sentence, shown on the catalogue card. What the caller learns, not which fields come back.</span>
        {touched && !fields.question.trim() && <span className="error">Required</span>}
      </div>

      <div className="field">
        <label htmlFor="inputs">Inputs</label>
        <textarea
          id="inputs"
          value={fields.inputs}
          onChange={set("inputs")}
          placeholder={"address: the position owner\nchain: ethereum | base | arbitrum"}
          style={{ minHeight: 80 }}
        />
        <span className="hint">One per line. Fixed choices as a | b | c.</span>
      </div>

      <div className="field">
        <label htmlFor="contact">Contact</label>
        <input id="contact" value={fields.contact} onChange={set("contact")} placeholder="GitHub handle or X" />
      </div>

      <div>
        <button type="button" className="btn btn-primary" onClick={open}>
          Open the listing request on GitHub
        </button>
        {touched && missing.length > 0 && (
          <p className="error" style={{ marginTop: 10 }}>
            Fill in {missing.join(", ")} first.
          </p>
        )}
      </div>
    </div>
  );
}
