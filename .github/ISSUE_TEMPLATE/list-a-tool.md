---
name: List a tool
about: List an x402 endpoint on OnchainRouter. Agents find it, call it, and pay you directly.
title: "List: <tool name>"
labels: listing
---

The endpoint has to answer `402 Payment Required` on Hedera (`hedera:testnet`) or Arc (`eip155:5042002`). Price and payout are read from that 402, so they are not asked for here. The submit page at /submit fills this in for you, and so does `POST /api/submit` or the `submit_tool` MCP tool.

**Endpoint**: https://

**402 as read by the router** (paste the `accepts` list, or the Check output)

**Name**:
**Category**:

**What it answers** (one sentence, shown on the catalogue card)

**Inputs** (one per line, `name: meaning`; fixed choices as `a | b | c`)

**Example request**
```json
{}
```

**Contact**:
