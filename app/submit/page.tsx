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

      <SubmitForm categories={CATEGORIES} />

      <div className="good-tool">
        <span className="step-no">What makes a good tool</span>
        <div className="good-grid">
          <div>
            <strong>One job</strong>
            <span>Answers one clear question or performs one clear action.</span>
          </div>
          <div>
            <strong>Agent-ready</strong>
            <span>Speaks x402 on Hedera or Arc, the rails every agent here pays on.</span>
          </div>
          <div>
            <strong>Outcome, not dump</strong>
            <span>Returns a useful result, and 404 when it has none, so nothing is charged.</span>
          </div>
          <div>
            <strong>Pay-per-call</strong>
            <span>Cheap enough for an agent to call again and again.</span>
          </div>
        </div>
      </div>

      <div className="closing-claim">
        <h2>You set the price. You keep the payment.</h2>
        <p>
          OnchainRouter handles discovery and routing. Your endpoint handles the work. The
          agent pays you directly. No invoice, no payout run, no minimum.
        </p>
      </div>
    </div>
  );
}
