# Hedera developer experience notes

Running log of friction hit while building OnchainRouter on Hedera.

Re-checked on 2026-09-12 against the current sources; corrections are marked inline.

---

## 2026-09-07

### 1. The official PoC defaults testnet to a different facilitator

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

*Correction, 2026-09-12:* this note originally also said Blocky402's site does not
publish its testnet URL. It does: `api.testnet.blocky402.com` is on the homepage and
at `blocky402.com/docs/testnet/`. Whether it was there on 2026-09-07 could not be
verified, so that claim is withdrawn. The PoC default is the finding.

**Reproduction**
1. Clone `hedera-dev/x402-inference-pay-per-request-poc`
2. `cat .env.example` and `packages/service/src/x402.ts`
3. Observe the testnet default is not Blocky402

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

### 2. HTS token association is a prerequisite for USDC payments (withdrawn)

*Withdrawn, 2026-09-12.* This note claimed the quickstart has no association step and
that settlement fails with `TOKEN_NOT_ASSOCIATED_TO_ACCOUNT` without it. On re-check,
the PoC README lists "Associate USDC (testnet)" as step 3 of its Quick Start, and
`@x402/hedera`'s README has a dedicated "Token Association" section. The failure itself
was never reproduced here: it was read from the SDK's type comments, not hit. What is
true is only that this router pays in native HBAR (`0.0.0`), which needs no association,
and that was a choice rather than a workaround.

---
