import { ImageResponse } from "next/og";
import { findTool } from "@/lib/tools/registry";
import { SITE_NAME } from "@/lib/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Tool on Onchain Router";

/**
 * One share card per tool, built from the same registry entry the page and the
 * endpoint use. A shared link shows what the tool answers and what it costs, which is
 * the whole decision a reader is making.
 */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const tool = findTool((await params).slug);

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
              width: 40,
              height: 40,
              borderRadius: 11,
              background: "#ea5924",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            R
          </div>
          <div style={{ display: "flex", color: "#66666f", fontSize: 24 }}>OnchainRouter</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", color: "#66666f", fontSize: 26 }}>
            {tool ? tool.category : "tool"}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 74,
              color: "#f2f2f5",
              letterSpacing: "-0.03em",
              marginTop: 10,
            }}
          >
            {tool ? tool.name : "Tool not found"}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 32,
              color: "#9a9aa6",
              marginTop: 22,
              lineHeight: 1.35,
              maxWidth: 900,
            }}
          >
            {tool ? tool.summary : "This tool is not in the catalogue."}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 24 }}>
          {tool && (
            <div
              style={{
                display: "flex",
                border: "1px solid #c94a1c",
                background: "rgba(234, 89, 36, 0.12)",
                borderRadius: 999,
                padding: "8px 20px",
                color: "#f4703f",
              }}
            >
              {tool.price} per call
            </div>
          )}
          {tool && (
            <div
              style={{
                display: "flex",
                border: "1px solid #2b2b33",
                borderRadius: 999,
                padding: "8px 20px",
                color: "#9a9aa6",
              }}
            >
              {tool.coverage}
            </div>
          )}
        </div>
      </div>
    ),
    size,
  );
}
