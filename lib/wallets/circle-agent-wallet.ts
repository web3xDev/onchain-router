import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import type { Address, Hex } from "viem";

/**
 * An agent wallet on Arc, backed by Circle rather than by a key in a file.
 *
 * The payment layer asks for a signer, not a key — an address and the ability to sign
 * EIP-712 typed data. That is a small enough surface that the key never has to exist
 * on this machine: Circle holds it, this adapter asks Circle to sign, and the spend
 * limits live beside the key instead of in application code that an attacker with the
 * key could simply skip.
 */

export type CircleAgentWalletConfig = {
  apiKey: string;
  entitySecret: string;
  walletId: string;
  address: Address;
};

export type BatchEvmSigner = {
  address: Address;
  signTypedData: (params: {
    domain: { name: string; version: string; chainId: number; verifyingContract: Address };
    types: Record<string, Array<{ name: string; type: string }>>;
    primaryType: string;
    message: Record<string, unknown>;
  }) => Promise<Hex>;
};

/**
 * Reads the wallet from the environment, or returns null so callers can fall back to
 * a local key. Arc works either way; only the custody of the key differs.
 */
export function circleAgentWalletFromEnv(): BatchEvmSigner | null {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
  const walletId = process.env.CIRCLE_WALLET_ID;
  const address = process.env.CIRCLE_WALLET_ADDRESS;

  if (!apiKey || !entitySecret || !walletId || !address) return null;

  return circleAgentWallet({
    apiKey,
    entitySecret,
    walletId,
    address: address as Address,
  });
}

export function circleAgentWallet(config: CircleAgentWalletConfig): BatchEvmSigner {
  const client = initiateDeveloperControlledWalletsClient({
    apiKey: config.apiKey,
    entitySecret: config.entitySecret,
  });

  return {
    address: config.address,

    async signTypedData({ domain, types, primaryType, message }) {
      // Circle takes the typed data as a JSON string and returns the signature.
      const response = await client.signTypedData({
        walletId: config.walletId,
        data: JSON.stringify({ domain, types, primaryType, message }),
        memo: "x402 payment",
      });

      const signature = response.data?.signature;
      if (!signature) {
        throw new Error("Circle returned no signature for the payment authorization");
      }

      return signature as Hex;
    },
  };
}
