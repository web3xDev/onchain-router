import { x402Client } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { ExactHederaScheme } from "@x402/hedera/exact/client";
import { createClientHederaSigner, HBAR_ASSET_ID, PrivateKey } from "@x402/hedera";
import { registerBatchScheme } from "@circle-fin/x402-batching/client";
import { privateKeyToAccount } from "viem/accounts";
import { circleAgentWalletFromEnv } from "@/lib/wallets/circle-agent-wallet";

/**
 * Builds a paying fetch from whatever wallet the operator configured, or returns null
 * when none is.
 *
 * Configuring one is a convenience, not a requirement: with a wallet the router settles
 * on the caller's behalf and returns data in one step; without one it returns the price
 * and the caller's own wallet pays. Either way the money is the caller's — the only
 * question is whose process holds the signing material.
 *
 * Preference order is deliberate. A Circle agent wallet keeps the key out of this
 * process entirely and enforces limits beside it; a raw key here works but is the
 * weakest of the options, and is only ever a fallback.
 */

const HEDERA_NETWORK = "hedera:testnet";
const ARC_NETWORK = "eip155:5042002";
const ARC_USDC = "0x3600000000000000000000000000000000000000";

export type AgentWallet = {
  fetch: typeof globalThis.fetch;
  /** Human-readable description of what is signing, for logs and setup checks. */
  describe: string;
};

export function agentWalletFromEnv(): AgentWallet | null {
  const client = new x402Client();
  const registered: string[] = [];

  // Spend limits. Neither native HBAR nor Arc USDC is a "default asset" the client
  // recognises, so both have to be allowlisted — which is the right shape anyway: an
  // agent wallet should carry an allowlist rather than a blank cheque.
  client.setSpendControls({
    allowedAssets: [
      {
        network: HEDERA_NETWORK,
        asset: HBAR_ASSET_ID,
        maxAmountPerPayment: process.env.AGENT_MAX_TINYBAR ?? "20000000", // 0.2 HBAR
      },
      {
        network: ARC_NETWORK,
        asset: ARC_USDC,
        maxAmountPerPayment: process.env.AGENT_MAX_ARC_USDC ?? "50000", // $0.05
      },
    ],
  });

  // ── Arc, preferring a wallet whose key never reaches this process ──────────
  const circle = circleAgentWalletFromEnv();
  const arcKey = process.env.ARC_AGENT_PRIVATE_KEY;

  if (circle) {
    registerBatchScheme(client, { signer: circle });
    registered.push(`Arc via Circle agent wallet ${circle.address}`);
  } else if (arcKey) {
    const account = privateKeyToAccount(arcKey as `0x${string}`);
    registerBatchScheme(client, { signer: account });
    registered.push(`Arc via local key ${account.address}`);
  }

  // ── Hedera ─────────────────────────────────────────────────────────────────
  const hederaId = process.env.HEDERA_AGENT_ACCOUNT_ID;
  const hederaKey = process.env.HEDERA_AGENT_PRIVATE_KEY;

  if (hederaId && hederaKey) {
    const signer = createClientHederaSigner(hederaId, PrivateKey.fromStringECDSA(hederaKey), {
      network: HEDERA_NETWORK,
    });
    client.register("hedera:*", new ExactHederaScheme(signer));
    registered.push(`Hedera via local key ${hederaId}`);
  }

  if (registered.length === 0) return null;

  return {
    fetch: wrapFetchWithPayment(fetch, client),
    describe: registered.join(", "),
  };
}
