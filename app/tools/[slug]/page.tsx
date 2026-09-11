import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { describeInputs, findTool, TOOLS } from "@/lib/tools/registry";
import { rails, resolvePayout } from "@/lib/x402";
import { siteUrl } from "@/lib/site";
import { Code } from "@/components/code";
import { Brand, type BrandId } from "@/components/brand";
import { Author } from "@/components/author";

// Same reason as the catalogue: the price and the accepted networks come from the
// running deployment's configuration, not from whatever was set when it was built.
export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return TOOLS.map((tool) => ({ slug: tool.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const tool = findTool((await params).slug);
  if (!tool) return { title: "Tool not found" };

  return {
    title: tool.name,
    description: tool.summary,
    openGraph: { title: `${tool.name}, ${tool.price} per call`, description: tool.summary },
    twitter: { title: `${tool.name}, ${tool.price} per call`, description: tool.summary },
  };
}

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const tool = findTool((await params).slug);
  if (!tool) notFound();

  const inputs = describeInputs(tool);
  const live = rails();
  const payout = resolvePayout(tool.payTo);
  const requestJson = JSON.stringify(tool.example.request);
  const base = siteUrl();

  return (
    <div className="page">
      <div className="detail">
        <Link href="/tools" className="back">
          ← all tools
        </Link>

        <div className="detail-head">
          <div>
            <h1>{tool.name}</h1>
            <div className="detail-meta">
              <span className="tag">{tool.category}</span>
              <span>{tool.slug}</span>
              <span>·</span>
              <span>{tool.coverage}</span>
              <span>·</span>
              <Author name={tool.author} size={13} />
            </div>
          </div>
        </div>

        <p className="detail-lede">{tool.description}</p>
      </div>

      <div className="detail-grid">
        <div>
          <div className="block">
            <h2>Arguments</h2>
            <div className="args">
              {inputs.map((input) => (
                <div key={input.name} className="arg">
                  <div>
                    <div className="arg-name">{input.name}</div>
                    <div className="arg-type">{input.type} · {input.required ? "required" : "optional"}</div>
                  </div>
                  <div>
                    <div className="arg-desc">{input.description}</div>
                    {input.options && (
                      <div className="arg-options">
                        {input.options.map((option) => (
                          <span key={option}>{option}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="block">
            <h2>What it answers</h2>
            <div style={{ marginBottom: 16 }}>
              <Code>{requestJson}</Code>
            </div>
            <div className="quote">{tool.example.answer}</div>
          </div>

          <div className="block">
            <h2>Call it from an agent</h2>
            <p style={{ color: "var(--text-2)", fontSize: 14, marginTop: 0 }}>
              Over MCP the tool is called by name and the payment is handled underneath.
            </p>
            <Code lang="ts">
              {`${tool.slug.replace(/-/g, "_")}(${inputs
                .map((i) => `${i.name}: ${JSON.stringify(tool.example.request[i.name] ?? "")}`)
                .join(", ")})`}
            </Code>
          </div>

          <div className="block">
            <h2>Call it over HTTP</h2>
            <p style={{ color: "var(--text-2)", fontSize: 14, marginTop: 0 }}>
              The first request returns 402 with the accepted networks. Sign one and repeat
              the request with the receipt.
            </p>
            <Code lang="sh">
              {`curl -X POST ${base}/api/tools/${tool.slug} \\
  -H 'Content-Type: application/json' \\
  -d '${requestJson}'

← 402 Payment Required
  PAYMENT-REQUIRED: ${live.map((r) => r.network).join(", ") || "no rail configured"}

curl -X POST ${base}/api/tools/${tool.slug} \\
  -H 'Content-Type: application/json' \\
  -H "PAYMENT-SIGNATURE: $RECEIPT" \\
  -d '${requestJson}'

← 200 OK`}
            </Code>
          </div>
        </div>

        <aside className="aside">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <h3>Price per call</h3>
            <span className="price">{tool.price}</span>
          </div>

          <div style={{ marginTop: 14 }}>
            {live.map((rail) => (
              <div key={rail.id} className="aside-row">
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Brand id={rail.id as BrandId} height={13} /> {rail.name}
                </span>
                <span>{rail.amount}</span>
              </div>
            ))}
            {tool.source && (
              <div className="aside-row">
                <span>data source</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {tool.source === "graph" ? (
                    <>
                      <Brand id="graph" height={13} /> The Graph
                    </>
                  ) : (
                    tool.source
                  )}
                </span>
              </div>
            )}
            <div className="aside-row">
              <span>coverage</span>
              <span>{tool.coverage}</span>
            </div>
            <div className="aside-row">
              <span>pays out to</span>
              <span>{tool.author}</span>
            </div>
            {tool.endpoint ? (
              <div className="aside-row">
                <span>settled at</span>
                <span>{new URL(tool.endpoint).host}</span>
              </div>
            ) : (
              <>
                {payout.hedera && (
                  <div className="aside-row">
                    <span>on Hedera</span>
                    <span>{payout.hedera}</span>
                  </div>
                )}
                {payout.arc && (
                  <div className="aside-row">
                    <span>on Arc</span>
                    <span>{payout.arc}</span>
                  </div>
                )}
              </>
            )}
            <div className="aside-row">
              <span>router commission</span>
              <span>0%</span>
            </div>
          </div>

          <div style={{ display: "grid", gap: 8, marginTop: 18 }}>
            <Link
              href={`/playground?tool=${tool.slug}`}
              className="btn btn-primary"
              style={{ justifyContent: "center" }}
            >
              Run it in the playground
            </Link>
            <Link href="/connect" className="btn" style={{ justifyContent: "center" }}>
              Connect your own agent
            </Link>
          </div>

          <p style={{ fontSize: 12.5, color: "var(--text-3)", marginBottom: 0 }}>
            Nothing is charged for reading this page, for a 402, or for a call the tool
            cannot answer. You pay for a verdict, not an attempt.
          </p>
        </aside>
      </div>
    </div>
  );
}
