import type { Metadata } from "next";
import { CATEGORIES } from "@/lib/tools/registry";
import { SubmitForm } from "@/components/submit-form";
import { Rotator } from "@/components/rotator";

const DESCRIPTION =
  "Turn your API into an agent-ready, pay-per-call tool, or bring an endpoint that already speaks x402. 0% commission, payments go straight to you.";

export const metadata: Metadata = {
  title: "Submit a tool",
  description: DESCRIPTION,
  openGraph: { title: "Submit a tool", description: DESCRIPTION },
  twitter: { title: "Submit a tool", description: DESCRIPTION },
};

/** Lucide icons (ISC), inlined so the page ships no icon package. */
const svg = (paths: string) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: paths }} />
);

const GOOD = [
  {
    title: "One job",
    text: "Answers one clear question or performs one clear action.",
    icon: svg('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>'),
  },
  {
    title: "Agent-ready",
    text: "Speaks x402 on Hedera or Arc, the rails every agent here pays on.",
    icon: svg('<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>'),
  },
  {
    title: "Outcome, not dump",
    text: "Returns a useful result, and 404 when it has none, so nothing is charged.",
    icon: svg('<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>'),
  },
  {
    title: "Pay-per-call",
    text: "Cheap enough for an agent to call again and again.",
    icon: svg('<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>'),
  },
];

export default function SubmitPage() {
  return (
    <div className="page submit-page">
      <div className="page-head">
        <span className="label">Submit</span>
        <h1>List your tool</h1>
        <p>
          Turn your API into an agent-ready, pay-per-call tool. Already using x402? Just bring
          the endpoint.
        </p>
        <div className="eyebrow-row">
          <Rotator items={["0% commission", "Direct settlement", "Hedera Testnet + Arc Testnet"]} />
        </div>
      </div>

      <div className="submit-cols">
      <SubmitForm categories={CATEGORIES} />

      <aside className="submit-aside">
      <div className="good-tool">
        <span className="step-no">What makes a good tool</span>
        <div className="good-grid">
          {GOOD.map((item) => (
            <div key={item.title}>
              <span className="good-icon" aria-hidden="true">{item.icon}</span>
              <strong>{item.title}</strong>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="closing-claim">
        <h2>You set the price. You keep the payment.</h2>
        <p>
          OnchainRouter handles discovery and routing. Your endpoint handles the work. The
          agent pays you directly. No invoice, no payout run, no minimum.
        </p>
      </div>
      </aside>
      </div>
    </div>
  );
}
