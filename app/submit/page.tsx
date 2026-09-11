import type { Metadata } from "next";
import { CATEGORIES } from "@/lib/tools/registry";
import { SubmitForm } from "@/components/submit-form";

const DESCRIPTION =
  "List an x402 endpoint on the router. Agents find it, call it and pay you directly.";

export const metadata: Metadata = {
  title: "Submit a tool",
  description: DESCRIPTION,
  openGraph: { title: "Submit a tool", description: DESCRIPTION },
  twitter: { title: "Submit a tool", description: DESCRIPTION },
};

export default function SubmitPage() {
  return (
    <div className="page prose">
      <div className="page-head">
        <span className="label">Submit</span>
        <h1>List your x402 endpoint</h1>
        <p>
          Already charging with x402? List the URL. Agents pay at your endpoint, the router
          takes nothing.
        </p>
      </div>

      <h2>What gets listed</h2>
      <ul>
        <li>Answers 402 with x402 payment requirements. Check reads the rest.</li>
        <li>Returns a verdict, not a table.</li>
        <li>Returns 404 when it has no answer, so nothing is charged.</li>
        <li>Costs cents, not dollars.</li>
      </ul>

      <h2>List it</h2>
      <p>
        Opens a prefilled GitHub issue. Once reviewed, your tool is live in the catalogue and
        over MCP.
      </p>

      <SubmitForm categories={CATEGORIES} />
    </div>
  );
}
