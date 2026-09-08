"use client";

import { useState } from "react";

const REPO = "https://github.com/web3xDev/onchain-router";

type Fields = {
  name: string;
  category: string;
  question: string;
  source: string;
  price: string;
  payTo: string;
  contact: string;
};

const EMPTY: Fields = {
  name: "",
  category: "",
  question: "",
  source: "",
  price: "$0.01",
  payTo: "",
  contact: "",
};

/**
 * A proposal form with no backend behind it.
 *
 * Submissions go to the repo's issue tracker, prefilled. That keeps the review in
 * public where anyone can see what was proposed and why it was accepted, and it means
 * this page is not quietly collecting addresses into a database no one audits.
 */
export function SubmitForm({ categories }: { categories: string[] }) {
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [touched, setTouched] = useState(false);

  const missing = (["name", "question", "source"] as const).filter((key) => !fields[key].trim());

  const set = (key: keyof Fields) => (event: { target: { value: string } }) =>
    setFields((current) => ({ ...current, [key]: event.target.value }));

  function open() {
    setTouched(true);
    if (missing.length > 0) return;

    const body = [
      `**Tool**: ${fields.name}`,
      `**Category**: ${fields.category || "(new category)"}`,
      "",
      "**Question it answers**",
      fields.question,
      "",
      "**Where the data comes from**",
      fields.source,
      "",
      `**Price per call**: ${fields.price || "not stated"}`,
      `**Pays to**: ${fields.payTo || "not stated"}`,
      `**Contact**: ${fields.contact || "not stated"}`,
    ].join("\n");

    const url =
      `${REPO}/issues/new?title=${encodeURIComponent(`Tool proposal: ${fields.name}`)}` +
      `&body=${encodeURIComponent(body)}`;

    window.open(url, "_blank", "noreferrer");
  }

  return (
    <div className="form">
      <div className="two-up">
        <div className="field">
          <label htmlFor="name">Tool name</label>
          <input
            id="name"
            value={fields.name}
            onChange={set("name")}
            placeholder="Liquidation risk"
          />
          {touched && !fields.name.trim() && <span className="error">Required</span>}
        </div>

        <div className="field">
          <label htmlFor="category">Category</label>
          <select id="category" value={fields.category} onChange={set("category")}>
            <option value="">Choose or leave blank for a new one</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <span className="hint">A new category is fine if nothing fits.</span>
        </div>
      </div>

      <div className="field">
        <label htmlFor="question">The question it answers</label>
        <textarea
          id="question"
          value={fields.question}
          onChange={set("question")}
          placeholder="How close is this position to liquidation, and what price move gets it there?"
        />
        <span className="hint">
          Write the sentence the tool would return, not the fields it would expose.
        </span>
        {touched && !fields.question.trim() && <span className="error">Required</span>}
      </div>

      <div className="field">
        <label htmlFor="source">Where the data comes from</label>
        <textarea
          id="source"
          value={fields.source}
          onChange={set("source")}
          placeholder="Subgraph id, RPC, or an existing API — and how fresh it is."
        />
        {touched && !fields.source.trim() && <span className="error">Required</span>}
      </div>

      <div className="two-up">
        <div className="field">
          <label htmlFor="price">Price per call</label>
          <input id="price" value={fields.price} onChange={set("price")} placeholder="$0.01" />
        </div>

        <div className="field">
          <label htmlFor="payTo">Pays to</label>
          <input
            id="payTo"
            value={fields.payTo}
            onChange={set("payTo")}
            placeholder="0x… or 0.0.…"
          />
          <span className="hint">Where settlement lands. Public either way.</span>
        </div>
      </div>

      <div className="field">
        <label htmlFor="contact">Contact</label>
        <input
          id="contact"
          value={fields.contact}
          onChange={set("contact")}
          placeholder="GitHub handle or X"
        />
      </div>

      <div>
        <button type="button" className="btn btn-primary" onClick={open}>
          Open the proposal on GitHub
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
