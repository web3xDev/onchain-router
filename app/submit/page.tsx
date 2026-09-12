import type { Metadata } from "next";
import { CATEGORIES } from "@/lib/tools/registry";
import { SubmitForm } from "@/components/submit-form";
import { SubmitPaths } from "@/components/submit-paths";

const DESCRIPTION =
  "List a tool on the router. Wrap your API in x402 with one call, or list an endpoint that already speaks it. Agents pay you directly.";

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
        <h1>List your tool</h1>
        <p>
          Have an API? Wrap it in x402 with one call and list it. Already charging with x402?
          List the URL. Either way agents pay at your endpoint and the router takes nothing.
        </p>
      </div>

      <h2>Get to a 402</h2>
      <SubmitPaths />

      <h2>What gets listed</h2>
      <ul>
        <li>
          Answers 402 with x402 payment requirements on Hedera or Arc, the two rails every
          agent here pays on. Check reads the rest.
        </li>
        <li>Does one job and reports the outcome. A decision, a transaction, a result; not a raw dump.</li>
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
