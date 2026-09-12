import { x402Client } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { ExactHederaScheme } from "@x402/hedera/exact/client";
import { createClientHederaSigner, PrivateKey } from "@x402/hedera";
import { registerBatchScheme } from "@circle-fin/x402-batching/client";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import {
  ARC_NETWORK,
  ARC_USDC,
  ARC_USDC_DECIMALS,
  HBAR_ASSET,
  HBAR_DECIMALS,
  HEDERA_NETWORK,
  explorerUrl,
  toAtomic,
} from "./rails.js";

/**
 * The paying side: an agent's wallet on Hedera and Arc, and a fetch that pays with it.
 *
 * Give it a wallet and it turns every 402 into a signed retry. The wallet is yours;
 * nothing here phones home. Spend caps apply per payment so a misbehaving service
 * cannot drain the account in one call.
 */

export type WalletConfig = {
  hedera?: { accountId: string; privateKey: string };
  arc?:
    | { privateKey: string }
    | { circle: { apiKey: string; entitySecret: string; walletId: string; address: string } };
  /** Per-payment caps. Defaults: 0.2 HBAR, 0.05 USDC. */
  maxPerCall?: { hbar?: string | number; usdc?: string | number };
  /** Pick this rail when a service offers both. */
  preferNetwork?: string;
  onQuote?: (quote: { networks: string[]; chosen: string; amount: string }) => void;
  onSettle?: (receipt: Receipt) => void;
};

export type Receipt = {
  success: boolean;
  network: string;
  payer?: string;
  transaction?: string;
  explorer: string | null;
};

export type Wallet = {
  client: x402Client;
  fetch: typeof globalThis.fetch;
  /** Which rails this wallet signs on, for logs. */
  describe: string;
  /** Receipt of the most recent settled payment through this wallet. */
  lastReceipt?: Receipt;
};

const EIP712_DOMAIN_FIELDS = [
  { name: "name", type: "string" },
  { name: "version", type: "string" },
  { name: "chainId", type: "uint256" },
  { name: "verifyingContract", type: "address" },
];

/** An Arc signer backed by a Circle developer-controlled wallet; the key stays with Circle. */
function circleSigner(c: { apiKey: string; entitySecret: string; walletId: string; address: string }) {
  const circle = initiateDeveloperControlledWalletsClient({
    apiKey: c.apiKey,
    entitySecret: c.entitySecret,
  });
  return {
    address: c.address as Address,
    async signTypedData({ domain, types, primaryType, message }: {
      domain: { name: string; version: string; chainId: number; verifyingContract: Address };
      types: Record<string, Array<{ name: string; type: string }>>;
      primaryType: string;
      message: Record<string, unknown>;
    }): Promise<Hex> {
      const data = JSON.stringify(
        { domain, types: { ...types, EIP712Domain: EIP712_DOMAIN_FIELDS }, primaryType, message },
        (_k, v) => (typeof v === "bigint" ? v.toString() : v),
      );
      const r = await circle.signTypedData({ walletId: c.walletId, data, memo: "x402 payment" });
      const signature = r.data?.signature;
      if (!signature) throw new Error("Circle returned no signature");
      return signature as Hex;
    },
  };
}

export function createWallet(config: WalletConfig): Wallet {
  const { preferNetwork } = config;
  const client = preferNetwork
    ? new x402Client((_v, reqs) => reqs.find((r) => r.network === preferNetwork) ?? reqs[0])
    : new x402Client();

  client.setSpendControls({
    allowedAssets: [
      {
        network: HEDERA_NETWORK,
        asset: HBAR_ASSET,
        maxAmountPerPayment: toAtomic(config.maxPerCall?.hbar ?? "0.2", HBAR_DECIMALS),
      },
      {
        network: ARC_NETWORK,
        asset: ARC_USDC,
        maxAmountPerPayment: toAtomic(config.maxPerCall?.usdc ?? "0.05", ARC_USDC_DECIMALS),
      },
    ],
  });

  if (config.onQuote) {
    client.onBeforePaymentCreation(async (ctx) => {
      config.onQuote!({
        networks: ctx.paymentRequired.accepts.map((a) => a.network),
        chosen: ctx.selectedRequirements.network,
        amount: ctx.selectedRequirements.amount,
      });
    });
  }

  const wallet: Wallet = { client, fetch, describe: "" };

  // The receipt is read off the client hook rather than the response header, which
  // some frameworks strip. Hooks cannot be removed, so one is registered here and
  // the latest receipt is kept on the wallet for `pay()` to pick up.
  client.onPaymentResponse(async (ctx) => {
    const s = (ctx as { settleResponse?: Record<string, unknown> }).settleResponse;
    if (!s) return;
    const network = String(s.network ?? "");
    const transaction = s.transaction ? String(s.transaction) : undefined;
    wallet.lastReceipt = {
      success: Boolean(s.success),
      network,
      payer: s.payer ? String(s.payer) : undefined,
      transaction,
      explorer: transaction ? explorerUrl(network, transaction) : null,
    };
    config.onSettle?.(wallet.lastReceipt);
  });

  const rails: string[] = [];

  if (config.arc) {
    if ("circle" in config.arc) {
      registerBatchScheme(client, { signer: circleSigner(config.arc.circle) });
      rails.push(`Arc via Circle wallet ${config.arc.circle.address}`);
    } else {
      const account = privateKeyToAccount(config.arc.privateKey as Hex);
      registerBatchScheme(client, { signer: account });
      rails.push(`Arc via local key ${account.address}`);
    }
  }

  if (config.hedera) {
    const signer = createClientHederaSigner(
      config.hedera.accountId,
      PrivateKey.fromStringECDSA(config.hedera.privateKey),
      { network: HEDERA_NETWORK },
    );
    client.register("hedera:*", new ExactHederaScheme(signer));
    rails.push(`Hedera via local key ${config.hedera.accountId}`);
  }

  if (rails.length === 0) {
    throw new Error("createWallet(): configure hedera, arc, or both.");
  }

  wallet.fetch = wrapFetchWithPayment(fetch, client);
  wallet.describe = rails.join(", ");
  return wallet;
}

/**
 * Reads the wallet from the environment:
 *   HEDERA_AGENT_ACCOUNT_ID, HEDERA_AGENT_PRIVATE_KEY
 *   ARC_AGENT_PRIVATE_KEY, or CIRCLE_API_KEY + CIRCLE_ENTITY_SECRET + CIRCLE_WALLET_ID + CIRCLE_WALLET_ADDRESS
 * Returns null when nothing is set.
 */
export function walletFromEnv(
  options: Omit<WalletConfig, "hedera" | "arc"> = {},
  env: Record<string, string | undefined> = process.env,
): Wallet | null {
  const config: WalletConfig = { ...options };

  if (env.HEDERA_AGENT_ACCOUNT_ID && env.HEDERA_AGENT_PRIVATE_KEY) {
    config.hedera = {
      accountId: env.HEDERA_AGENT_ACCOUNT_ID,
      privateKey: env.HEDERA_AGENT_PRIVATE_KEY,
    };
  }

  if (env.CIRCLE_API_KEY && env.CIRCLE_ENTITY_SECRET && env.CIRCLE_WALLET_ID && env.CIRCLE_WALLET_ADDRESS) {
    config.arc = {
      circle: {
        apiKey: env.CIRCLE_API_KEY,
        entitySecret: env.CIRCLE_ENTITY_SECRET,
        walletId: env.CIRCLE_WALLET_ID,
        address: env.CIRCLE_WALLET_ADDRESS,
      },
    };
  } else if (env.ARC_AGENT_PRIVATE_KEY) {
    config.arc = { privateKey: env.ARC_AGENT_PRIVATE_KEY };
  }

  if (!config.hedera && !config.arc) return null;
  return createWallet(config);
}

export type PayResult<T = unknown> = {
  status: number;
  data: T;
  /** Present when a payment settled. Absent on a free answer, a 404 or an error. */
  receipt?: Receipt;
};

/**
 * One paid call: POST JSON, pay the 402 if there is one, return the answer.
 *
 * `pay("https://onchainrouter.io/api/tools/lending-rates", { asset: "USDC", chain: "base" }, wallet)`
 */
export async function pay<T = unknown>(
  url: string,
  input: Record<string, unknown>,
  wallet: Wallet,
): Promise<PayResult<T>> {
  wallet.lastReceipt = undefined;
  const response = await wallet.fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await response.json().catch(() => null)) as T;
  return { status: response.status, data, receipt: wallet.lastReceipt };
}

export { HEDERA_NETWORK, ARC_NETWORK, explorerUrl } from "./rails.js";
