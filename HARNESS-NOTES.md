# Hedera developer experience notes

Running log of friction hit while building Onchain Router on Hedera.
Written **at the moment it happens**, not reconstructed afterwards.

Target: a meaningful contribution to [hedera-dev/hedera-harness](https://github.com/hedera-dev/hedera-harness)
(ETHOnline 2026, "Open Source: Improve the Hedera Harness").

---

## 2026-09-07

### 1. Testnet facilitator URL is undocumented and the official PoC points elsewhere

**Problem**
The ETHOnline Hedera bounty requires the x402 service to settle **via Blocky402**.
Hedera's own reference PoC (`hedera-dev/x402-inference-pay-per-request-poc`) ships these
defaults in `.env.example` and in `packages/service/src/x402.ts`:

```
X402_TESTNET_FACILITATOR_URL=https://x402.org/facilitator
X402_MAINNET_FACILITATOR_URL=https://api.blocky402.com
```

**Expected**
Following the official PoC on testnet should put me on the facilitator the docs and
bounty point at.

**Actual**
The PoC uses `x402.org` on testnet and Blocky402 only on mainnet. A developer who
copies the PoC verbatim ships against the wrong facilitator without any warning.
Blocky402's own site says Hedera Testnet is supported but does not publish the URL.

**Reproduction**
1. Clone `hedera-dev/x402-inference-pay-per-request-poc`
2. `cat .env.example` and `packages/service/src/x402.ts`
3. Observe the testnet default is not Blocky402
4. Search Blocky402's site for a testnet endpoint: not listed

**How I resolved it**
`https://api.testnet.blocky402.com`, confirmed by hitting `/supported`, which returns:

```json
{"x402Version":2,"scheme":"exact","network":"hedera:testnet","extra":{"feePayer":"0.0.7162784"}}
```

**Proposed improvement**
Document both facilitator endpoints (testnet + mainnet) in the PoC README and in the
Hedera x402 docs, and make the testnet default consistent with what the ecosystem
actually recommends.

---

### 2. HTS token association is a hidden prerequisite for USDC payments

**Problem**
Paying in USDC requires the *receiving* account to be associated with the token first.
There is no association step in the happy path of the quickstart; it lives in a separate
script (`scripts/associate-token.ts`).

**Expected**
Following the quickstart end to end produces a successful USDC payment.

**Actual**
Without association, settlement fails with `TOKEN_NOT_ASSOCIATED_TO_ACCOUNT`. The
`@x402/hedera` types acknowledge this failure mode explicitly in
`FacilitatorHederaSigner.signAndSubmitTransaction`, which means it is a known and
expected trap rather than an edge case.

**Impact**
This is a Hedera-specific concept with no equivalent on EVM chains. A developer coming
from Base/x402 has no reason to expect it and will read the failure as a broken
integration rather than a missing setup step.

**Workaround used here**
Default to native HBAR (`asset 0.0.0`) for the first payment, which needs no
association, and only move to USDC once the rail is proven.

**Proposed improvement**
Surface association as a numbered step in the quickstart, and/or have the tooling
detect a missing association and emit an actionable error that names the token id and
the command to fix it.

---
