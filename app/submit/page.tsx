import type { Metadata } from "next";
import { CATEGORIES } from "@/lib/tools/registry";
import { SubmitForm } from "@/components/submit-form";

const DESCRIPTION =
  "Propose an onchain tool for the router and earn on every call agents make.";

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
        <h1>List your tool on the router</h1>
        <p>
          If you can answer a question about onchain state, agents will pay you per call for
          it. No revenue share to negotiate up front. Payments settle straight to the
          address you name.
        </p>
      </div>

      <h2>What makes a good tool</h2>
      <ul>
        <li>
          It answers a question rather than returning a table. &quot;Where should I lend
          USDC&quot; beats &quot;here are 27 markets&quot;.
        </li>
        <li>
          It says when the data is not trustworthy. A rate no one can actually get should be
          called out, not ranked first.
        </li>
        <li>It is cheap enough that an agent calls it without thinking. Cents, not dollars.</li>
      </ul>

      <h2>Propose it</h2>
      <p>
        This opens a prefilled issue on the repo. Nothing is sent anywhere until you press
        the button on GitHub.
      </p>

      <SubmitForm categories={CATEGORIES} />
    </div>
  );
}
