import Link from "next/link";
import { catalogue, CATEGORIES, TOOLS } from "@/lib/tools/registry";
import { rails } from "@/lib/x402";
import { ToolCatalogue } from "@/components/tool-catalogue";

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
            <span className="eyebrow">
              <span className="dot-live" /> {live.length} payment rails live
            </span>

            <h1>
              The <span className="accent">OpenRouter</span>
              <br />
              for onchain tools
            </h1>

            <p className="hero-sub">
              Point your agent at one MCP endpoint. It discovers what onchain tools exist,
              calls the one it needs, and pays for that call from its own wallet.
            </p>

            <div className="hero-actions">
              <Link href="/connect" className="btn btn-primary">
                Connect your agent
              </Link>
              <Link href="/playground" className="btn">
                Try it without a wallet
              </Link>
            </div>

            <p className="hero-note">No account. No API key. No subscription.</p>
          </div>

          <div className="terminal">
            <div className="terminal-bar">
              <span className="terminal-dot" />
              <span className="terminal-dot" />
              <span className="terminal-dot" />
              <span style={{ marginLeft: 6 }}>agent · lending-rates</span>
            </div>
            <pre className="terminal-body">
              <span className="t-dim">$ </span>
              <span className="t-key">POST /api/tools/lending-rates</span>
              {"\n"}
              <span className="t-dim">{'  { "asset": "USDC", "chain": "ethereum" }'}</span>
              {"\n\n"}
              <span className="t-warn">← 402 Payment Required</span>
              {"\n"}
              <span className="t-dim">{"  accepts: hedera:testnet, eip155:5042002"}</span>
              {"\n\n"}
              <span className="t-dim">{"  agent signs from its own wallet"}</span>
              {"\n"}
              <span className="t-dim">{"  ↳ settled 0.1 HBAR"}</span>
              {"\n\n"}
              <span className="t-ok">← 200 OK</span>
              {"\n"}
              <span className="t-key">
                {'  "Best supply rate: 4.51% on compound-v3,\n   backed by $376.0M of liquidity.'}
              </span>
              {"\n"}
              <span className="t-key">
                {'   iron-bank reports 75.10%, stale data\n   from an abandoned protocol,'}
              </span>
              {"\n"}
              <span className="t-key">{'   not an offer."'}</span>
            </pre>
          </div>
        </div>
      </section>

      <section className="section page">
        <div className="section-head">
          <div>
            <span className="label">Catalogue</span>
            <h2 style={{ marginTop: 8 }}>{TOOLS.length} tools, priced per call</h2>
            <p>
              Every tool answers a question rather than returning a table. You pay when it
              answers, and nothing when you are only looking.
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
            <h3>The agent pays</h3>
            <p>
              It signs the payment with its own wallet and the call returns. The router never
              holds your keys and never bills you.
            </p>
          </div>
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
              <div className="rail-head">
                <span className="dot-live" />
                {rail.name}
              </div>
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
