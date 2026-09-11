import Link from "next/link";
import { catalogue, CATEGORIES, TOOLS } from "@/lib/tools/registry";
import { SUPPORTED_CHAINS } from "@/lib/graph/deployments";
import { LIVE_GOVERNANCE_PROTOCOLS } from "@/lib/graph/verified";
import { rails } from "@/lib/x402";
import { ToolCatalogue } from "@/components/tool-catalogue";
import { HeroTerminal } from "@/components/hero-terminal";

// The rails are read from the deployment's own configuration, so this renders per
// request rather than being frozen into the build. A page that says "0 rails live"
// because an env var was missing at build time is worse than a slightly slower page.
export const dynamic = "force-dynamic";

export default function Home() {
  const tools = catalogue();
  const live = rails();

  return (
    <>
      <section className="hero">
        <div className="page hero-grid">
          <div>
            <h1>
              Onchain answers
              <br />
              for AI agents
            </h1>

            <p className="hero-sub">
              Skip the API keys, subscriptions, and raw data. Call an onchain tool, pay a
              cent, get a decision.
            </p>

            <div className="hero-actions">
              <Link href="/connect" className="btn btn-primary">
                Connect your agent
              </Link>
              <Link href="/playground" className="btn">
                Try the playground
              </Link>
            </div>

            <p className="hero-note">
              No account. No API key. No subscription.
              <br />
              No answer, no charge.
            </p>

            <div className="proof">
              <span>{TOOLS.length} tools</span>
              <span>{SUPPORTED_CHAINS.length} chains · {LIVE_GOVERNANCE_PROTOCOLS.length} protocols</span>
              <span>$0.01 per call</span>
              <span>0% router commission</span>
            </div>
          </div>

          <HeroTerminal />
        </div>
      </section>

      <section className="section page" id="tools" style={{ scrollMarginTop: 72 }}>
        <div className="section-head">
          <div>
            <span className="label">Catalogue</span>
            <h2 style={{ marginTop: 8 }}>{TOOLS.length} tools, priced per call</h2>
            <p>
              Every tool answers a question rather than returning a table. You pay when it
              answers. If it cannot give a verdict, the call is free.
            </p>
          </div>
          <Link href="/submit" className="btn btn-sm">
            Submit a tool
          </Link>
        </div>

        <ToolCatalogue tools={tools} categories={CATEGORIES} />
      </section>

      <section className="section page" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <div>
            <span className="label">How it works</span>
            <h2 style={{ marginTop: 8 }}>Three steps, no signup anywhere</h2>
            <p>The OpenRouter model, for onchain tools.</p>
          </div>
        </div>

        <div className="steps">
          <div className="step">
            <div className="step-n">01</div>
            <h3>Connect once</h3>
            <p>
              Add the router as an MCP server. Your agent sees every tool in the catalogue,
              with its price, straight away.
            </p>
          </div>
          <div className="step">
            <div className="step-n">02</div>
            <h3>Call a tool</h3>
            <p>
              The first call comes back 402 with the price and the networks accepted. Nothing
              has been charged yet.
            </p>
          </div>
          <div className="step">
            <div className="step-n">03</div>
            <h3>The agent pays, for an answer</h3>
            <p>
              It signs with its own wallet and the call returns. If the tool has nothing to
              say, the payment is never settled. You buy verdicts, not attempts.
            </p>
          </div>
        </div>
      </section>

      <section className="section page" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <div>
            <span className="label">For tool authors</span>
            <h2 style={{ marginTop: 8 }}>List a tool, get paid per call, straight to your wallet</h2>
            <p>
              Every call an agent makes settles directly from its wallet to yours. No invoice,
              no payout run, no minimum. The router takes 0% commission, for now.
            </p>
          </div>
          <Link href="/submit" className="btn btn-sm">
            Submit a tool
          </Link>
        </div>
      </section>

      <section className="section page" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <div>
            <span className="label">Payment rails</span>
            <h2 style={{ marginTop: 8 }}>Pay on whichever chain your agent already funds</h2>
            <p>
              One 402 advertises every rail at once. The agent picks; the tool never learns
              which one settled.
            </p>
          </div>
        </div>

        <div className="rails">
          {live.map((rail) => (
            <div key={rail.id} className="rail">
              <div className="rail-head">{rail.name}</div>
              <dl>
                <dt>network</dt>
                <dd>{rail.network}</dd>
                <dt>asset</dt>
                <dd>{rail.asset}</dd>
                <dt>per call</dt>
                <dd>{rail.amount}</dd>
                <dt>settles via</dt>
                <dd>{rail.settlement}</dd>
              </dl>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
