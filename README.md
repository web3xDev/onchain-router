# Onchain Router

**OpenRouter for onchain tools.**

AI agents connect once through MCP and gain access to a network of onchain
capabilities, paying per call with x402 — no signup, no API keys, no subscriptions.

> **Onchain Router handles:** Discovery → Routing → Payment → Execution
> **The agent handles:** Reasoning → Decision → User interaction

Built at ETHOnline 2026 (From Scratch track).

---

## Status

Day 1 of 6. The payment rail comes first; tools and MCP follow.

| | |
|---|---|
| ✅ | x402-gated endpoint offering Hedera and Arc in a single 402 |
| ✅ | Real payment settled on Hedera testnet via Blocky402 |
| ✅ | Real payment settled on Arc testnet via Circle Gateway |
| ⬜ | Agent wallets (Hedera Agent Kit, Circle Agent Stack) |
| ⬜ | MCP server |
| ⬜ | Graph-backed tools (`token-risk`, `wallet-profile`, `exit-liquidity`) |
| ⬜ | Playground |

---

## How payment works

```
Agent
  │  HTTP
  ▼
POST /api/tools/test
  │
  ├─ 402 Payment Required   (accepts: hedera:testnet)
  │
  ├─ agent signs a partially-signed TransferTransaction
  │
  ├─ Blocky402 verifies, adds the fee-payer signature, submits
  │
  ▼
200 { ok: true }
```

The facilitator sponsors network fees, so the agent needs no HBAR for gas beyond
the payment itself. Settlement details reach the client through its
`onPaymentResponse` hook.

---

## Connect your agent

The MCP server is a catalogue, not a cashier. It tells an agent what is available and
what each capability costs, and the agent settles from its own wallet. No key is
configured in the server and no funds pass through it.

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

Two tools appear: `lending_rates` and `governance_power`. Calling one without payment
returns its price and the networks it accepts:

```
Payment required before this tool returns data.

Endpoint: POST /api/tools/lending-rates
Accepted payment options:
  • hedera:testnet    — 0.1 HBAR
  • eip155:5042002    — 0.01 USDC on Arc

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
it — a router that paid on your agent's behalf would put its balance in the middle of
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

A model cannot compute a signature itself, but that is how every agent action works —
it cannot fetch a page either, it calls a tool that fetches. Signing is the same, and
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

- **agent** — pays for tool calls
- **service** — receives payments

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
npm run dev        # terminal 1 — the router
npm run pay        # terminal 2 — the paying agent
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
  api/tools/test/route.ts   x402-gated smoke-test tool
  page.tsx                  landing
lib/
  x402.ts                   facilitator, resource server, pricing
scripts/
  pay.ts                    paying-agent test client
HARNESS-NOTES.md            Hedera DX friction log
```

---

## Sponsors

| Layer | Sponsor |
|---|---|
| Data | The Graph — Subgraphs on standardized (Messari) schemas |
| Payment | Hedera — x402 via Blocky402 |
| Payment | Arc — x402 via Circle, Circle Agent Stack wallet |

---

## License

[AGPL-3.0-or-later](./LICENSE)
