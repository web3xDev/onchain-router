import { ImageResponse } from "next/og";
import { TOOLS } from "@/lib/tools/registry";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${SITE_NAME}, ${SITE_TAGLINE}`;

/**
 * The share card.
 *
 * Rendered rather than shipped as a file so it stays true as the catalogue grows:
 * the tool count on the card is the tool count in the registry.
 *
 * Satori supports a subset of CSS. Everything here is flexbox, every element that
 * has children declares display: flex, and there are no custom fonts to load.
 */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#141414",
          padding: "72px 76px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "#d25020",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            R
          </div>
          <div style={{ display: "flex", color: "#9a9aa6", fontSize: 26 }}>OnchainRouter</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 82,
              color: "#f2f2f5",
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
            }}
          >
            Onchain answers
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 82,
              color: "#f2f2f5",
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
            }}
          >
            for AI agents
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#9a9aa6", marginTop: 26 }}>
            Call an onchain tool, pay a cent, get a decision.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 24 }}>
          {[`${TOOLS.length} tools`, "Hedera + Arc", "No account"].map((chip) => (
            <div
              key={chip}
              style={{
                display: "flex",
                border: "1px solid #2b2b33",
                borderRadius: 999,
                padding: "8px 20px",
                color: "#9a9aa6",
              }}
            >
              {chip}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
