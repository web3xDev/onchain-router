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
| ✅ | x402-gated endpoint on Hedera testnet via Blocky402 |
| ✅ | Paying-agent test client |
| ⬜ | Arc as a second payment rail |
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
200 { ok: true }   + X-PAYMENT-RESPONSE with the Hedera transaction id
```

The facilitator sponsors network fees, so the agent needs no HBAR for gas beyond
the payment itself.

### Why the agent, not Claude, holds the key

MCP has no HTTP status channel, so `tools/call` cannot return a 402. It does not
need to: the **MCP server is the x402 client**. The 402 exchange happens over plain
HTTP between the MCP server and this API. Claude just calls a tool and gets a result.

```
Claude          (no key)
  │ MCP
MCP server      (agent's wallet lives here)
  │ HTTP + x402
Onchain Router  (402 → pay → settle)
  │
Hedera / Arc
```

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

Required by the bounty. Confirmed against `/supported`, which advertises
`{"scheme":"exact","network":"hedera:testnet","extra":{"feePayer":"0.0.7162784"}}`.

Note that Hedera's official PoC defaults **testnet** to `x402.org/facilitator` and
only uses Blocky402 on mainnet — copying it verbatim would target the wrong
facilitator. See [HARNESS-NOTES.md](./HARNESS-NOTES.md).

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
