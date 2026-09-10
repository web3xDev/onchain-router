# Onchain Router

**OpenRouter for onchain tools.**

AI agents connect once through MCP and gain access to a network of onchain
capabilities, paying per call with x402. No signup, no API keys, no subscriptions.

> **Onchain Router handles:** Discovery → Routing → Payment → Execution
> **The agent handles:** Reasoning → Decision → User interaction

Built at ETHOnline 2026 (From Scratch track).

---

## Status

Everything below is running against live data and settling real payments on testnet.

| | |
|---|---|
| ✅ | One 402 offering both Hedera and Arc; the agent pays on whichever it holds |
| ✅ | Payment settled on Hedera testnet via Blocky402, verified on HashScan |
| ✅ | Payment settled on Arc testnet via Circle Gateway, verified by balance |
| ✅ | Arc signed by a Circle agent wallet, so the key never reaches this machine |
| ✅ | `lending_rates`: best rate across every indexed lending protocol on a chain |
| ✅ | `governance_power`: how concentrated a protocol's voting power is |
| ✅ | Remote MCP at `/mcp`: one URL, agent pays from its own wallet over x402 |
| ✅ | Local MCP server for chat clients, with three ways to arrange payment |
| ✅ | Site: catalogue, tool pages, connect, submit |
| ✅ | Playground, funded by us, so it can be tried without a wallet |
| ✅ | Coverage measured rather than claimed (`npm run probe`) |

---

## How payment works

```
Agent
  │  HTTP
  ▼
POST /api/tools/lending-rates
  │
  ├─ 402 Payment Required   (accepts: hedera:testnet)
  │
  ├─ agent signs a partially-signed TransferTransaction
  │
  ├─ Blocky402 verifies, adds the fee-payer signature, submits
  │
  ▼
200 { "assessment": "Best supply rate: 4.51% on compound-v3…" }
```

The facilitator sponsors network fees, so the agent needs no HBAR for gas beyond
the payment itself. Settlement details reach the client through its
`onPaymentResponse` hook.

---

## Connect your agent

### By URL

The router is a remote MCP server. An x402-aware client connects to `/mcp`, lists the
tools for free, and pays for each call from its own wallet. The router never holds a
key; it receives a signed payment inside the tool call and settles it.

```ts
const agent = wrapMCPClientWithPayment(new Client({ name: "my-agent", version: "1.0.0" }), paymentClient);
await agent.connect(new StreamableHTTPClientTransport(new URL("https://<host>/mcp")));
const result = await agent.callTool("lending_rates", { asset: "USDC", chain: "base" });
```

`npm run mcp:remote` is a working copy of that: it connects, gets the payment-required
error, signs on whichever rail is configured, and prints the receipt and the answer.
Malformed arguments are rejected before the payment step, so a typo costs nothing.

### Locally, for chat clients

A chat client cannot sign a payment itself, so for Claude Code or Claude Desktop the
local server runs beside it and pays from a wallet you configure. It always tells the
agent what is available and what each capability costs; whether it also settles is your
choice, and there are three ways to arrange it.

```json
{
  "mcpServers": {
    "onchain-router": {
      "command": "npx",
      "args": ["tsx", "mcp/server.ts"],
      "env": { "ONCHAIN_ROUTER_URL": "http://localhost:3000" }
    }
  }
}
```

**Bring your own wallet (default).** Configured as above, the server holds nothing. A
tool call returns the price and the networks accepted, and your agent pays from
whatever wallet it already has: a Circle agent wallet, a Hedera wallet MCP, any x402
client. Nothing here ever touches a key.

**Let the server settle, through Circle.** Add `CIRCLE_API_KEY`, `CIRCLE_ENTITY_SECRET`,
`CIRCLE_WALLET_ID` and `CIRCLE_WALLET_ADDRESS` and Arc calls settle in one step. The
private key stays inside Circle and never reaches this machine; these credentials
command it rather than being it. This is the recommended way to have the server pay.

**Let the server settle, with a raw key.** `HEDERA_AGENT_ACCOUNT_ID` and
`HEDERA_AGENT_PRIVATE_KEY` work the same way for the Hedera rail. It is the weakest of
the three: a private key in a config file is readable by anything that can read the
file.

> Whichever you choose, fund a wallet that exists only for this. Never point it at a
> key you would mind losing. Per-payment caps are set in
> [`lib/payment/agent-wallet.ts`](./lib/payment/agent-wallet.ts) and default to 0.2 HBAR
> and $0.05.

On start the server says which arrangement is live:

```
onchain-router: settling via Arc via Circle agent wallet 0x266b…, Hedera via local key 0.0.10407265
onchain-router: quote-only, no wallet configured
```

Two tools appear: `lending_rates` and `governance_power`. Calling one without payment
returns its price and the networks it accepts:

```
Payment required before this tool returns data.

Endpoint: POST /api/tools/lending-rates
Accepted payment options:
  • hedera:testnet    · 0.1 HBAR
  • eip155:5042002    · 0.01 USDC on Arc

Settle one of these from your own wallet with x402, then call this tool again
with the payment receipt, or pay the endpoint directly.
```

An agent with an x402-capable wallet pays whichever rail it holds funds on and calls
again. Check the server is responding with `npm run mcp:check`.

---

### Where the wallet lives

The agent has its own wallet, the way a contractor has a company card: it spends on
its own, within limits someone set.

Nothing here holds that key. The MCP server carries no wallet and no funds pass through
it. A router that paid on your agent's behalf would put its balance in the middle of
your transaction and turn a payment protocol into a billing relationship.

```
Agent           holds a wallet, decides, signs, pays
  │ MCP
MCP server      catalogue: what exists, what it costs, where to pay
  │ HTTP + x402
Onchain Router  402 → verify → settle
  │
Hedera / Arc
```

A model cannot compute a signature itself, but that is how every agent action works.
It cannot fetch a page either, it calls a tool that fetches. Signing is the same, and
each network has a wallet kit for it:

| Network | Agent wallet |
|---|---|
| Hedera | Hedera Agent Kit |
| Arc | Circle Agent Stack |

> The Playground is the one exception: it funds a wallet of its own so the work can be
> tried without one of yours.
>
> `scripts/pay.ts` signs with a raw key on purpose. It is a smoke test for the payment
> rail, not the architecture.

---

## Setup

### 1. Wallets

Create **two ECDSA accounts** at [portal.hedera.com](https://portal.hedera.com) and
fund both with testnet HBAR.

- **agent** pays for tool calls
- **service** receives payments

### 2. Configure

```bash
cp .env.example .env.local
```

Fill in the two account ids and the agent's private key.

Defaults pay in **native HBAR**, which needs no HTS token association. Switch to
USDC (`X402_ASSET=usdc`) only after associating the service wallet with token
`0.0.429274`, otherwise settlement fails with `TOKEN_NOT_ASSOCIATED_TO_ACCOUNT`.

### 3. Run

```bash
npm install
npm run dev        # terminal 1, the router
npm run pay        # terminal 2, the paying agent
```

A successful run prints the settlement and a HashScan link.

---

## Facilitator

```
https://api.testnet.blocky402.com
```

Settlement runs through Blocky402, which sponsors the network fee so a paying agent
needs no gas of its own. Confirmed against `/supported`, which advertises
`{"scheme":"exact","network":"hedera:testnet","extra":{"feePayer":"0.0.7162784"}}`.

The endpoint is worth stating explicitly: Hedera's reference implementation defaults
**testnet** to `x402.org/facilitator` and reaches for Blocky402 only on mainnet, and
Blocky402's own site does not publish a testnet URL. Following either one alone lands
you somewhere other than where you meant to be. See [HARNESS-NOTES.md](./HARNESS-NOTES.md).

---

## Layout

```
app/
  page.tsx                  catalogue, the landing page
  tools/[slug]/page.tsx     one page per tool, generated from the registry
  connect/, submit/         connect an agent, propose a tool
  playground/               run a tool against a wallet we fund
  api/tools/route.ts        the catalogue, free to read
  api/tools/[slug]/route.ts every paid tool, one handler
  api/playground/route.ts   the only place the router spends its own money
lib/
  tools/registry.ts         every tool declared once
  graph/verified.ts         what `npm run probe` measured as live
  x402.ts                   facilitator, resource server, pricing
  payment/agent-wallet.ts   builds a paying fetch from whatever is configured
mcp/server.ts               local MCP server for chat clients, pays from a configured wallet
lib/mcp/remote.ts           remote MCP server, served at /mcp, caller pays over x402
app/mcp/route.ts            the /mcp endpoint
scripts/
  pay.ts                    paying-agent test client, HTTP
  mcp-remote-check.ts       paying-agent test client, remote MCP
  probe-coverage.ts         measures which subgraphs still answer
HARNESS-NOTES.md            Hedera DX friction log
```

---

## Sponsors

| Layer | Sponsor |
|---|---|
| Data | The Graph. Subgraphs on standardized (Messari) schemas |
| Payment | Hedera. x402 via Blocky402 |
| Payment | Arc. x402 via Circle, Circle Agent Stack wallet |

---

## License

[AGPL-3.0-or-later](./LICENSE)
