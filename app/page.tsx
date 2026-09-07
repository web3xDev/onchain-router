export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "96px 24px" }}>
      <h1 style={{ fontSize: 40, lineHeight: 1.1, margin: 0, letterSpacing: "-0.02em" }}>
        Onchain Router
      </h1>
      <p style={{ fontSize: 18, color: "#a0a0a8", marginTop: 16 }}>
        The onchain tool router for AI agents.
      </p>
      <p style={{ fontSize: 15, color: "#7a7a84", marginTop: 24, lineHeight: 1.6 }}>
        Connect any MCP-compatible agent to onchain capabilities, with discovery,
        routing and pay-per-use handled by one interface.
      </p>

      <pre
        style={{
          marginTop: 40,
          padding: 16,
          background: "#151517",
          border: "1px solid #232327",
          borderRadius: 8,
          fontSize: 13,
          color: "#a0a0a8",
          overflowX: "auto",
        }}
      >
        {`POST /api/tools/test
  -> 402 Payment Required
  -> pay on Hedera testnet via Blocky402
  -> 200 { ok: true }`}
      </pre>

      <p style={{ fontSize: 13, color: "#5a5a64", marginTop: 32 }}>
        Day 1: payment rail only. Playground, MCP server and Graph-backed tools land next.
      </p>
    </main>
  );
}
