"use client";

import { useState } from "react";
import { Code } from "@/components/code";

type Path = "x402" | "wrap";

/**
 * Two ways in. An endpoint that already answers 402 is listed as is. One that does
 * not gets wrapped first, with the same package the router itself is built on, and
 * then listed the same way. Either way the form below reads everything off the 402.
 */
export function SubmitPaths() {
  const [path, setPath] = useState<Path>("wrap");

  return (
    <div>
      <div className="segmented" style={{ marginBottom: 16 }}>
        <button type="button" aria-pressed={path === "wrap"} onClick={() => setPath("wrap")}>
          I have an API
        </button>
        <button type="button" aria-pressed={path === "x402"} onClick={() => setPath("x402")}>
          I already speak x402
        </button>
      </div>

      {path === "wrap" ? (
        <>
          <p>
            Put a paywall in front of your function with <code>onchainrouter</code>. One call,
            both rails, your address in the 402. The money never passes through here.
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
    description: "Liquidation risk for a lending position",
  },
  async (input) => {
    const result = await yourExistingLogic(input);
    if (!result) return null;   // no answer, no charge
    return result;
  },
);`}
          </Code>
          <p>
            That is a complete Next.js route, and a plain <code>(Request) =&gt; Response</code>{" "}
            for Hono, Bun, Workers or Express. Deploy it, then list the URL below: Check reads
            the price and rails off your 402.
          </p>
        </>
      ) : (
        <>
          <p>
            Your endpoint answers 402 with x402 payment requirements on Hedera or Arc. List
            the URL below; the router relays your 402 to callers and their signed payment
            back to you. Settlement happens at your endpoint, to your address.
          </p>
        </>
      )}
    </div>
  );
}
