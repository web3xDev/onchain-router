/**
 * The two rails, as constants. Everything else in the package reads from here.
 *
 * Testnet only for now. Both facilitators are public and take no API key, which is
 * what lets `paid()` work with nothing but a price and an address.
 */

export const HEDERA_NETWORK = "hedera:testnet";
export const HEDERA_FACILITATOR_URL = "https://api.testnet.blocky402.com";
/** Native HBAR. Needs no token association, unlike USDC on Hedera. */
export const HBAR_ASSET = "0.0.0";
export const HBAR_DECIMALS = 8;

export const ARC_NETWORK = "eip155:5042002";
export const ARC_USDC = "0x3600000000000000000000000000000000000000";
export const ARC_USDC_DECIMALS = 6;
/** Circle Gateway's testnet API. The package default points at mainnet, which is wrong here. */
export const CIRCLE_GATEWAY_URL = "https://gateway-api-testnet.circle.com";

export const NETWORKS = { hedera: HEDERA_NETWORK, arc: ARC_NETWORK } as const;
export type RailName = keyof typeof NETWORKS;

/** "0.1" HBAR -> "10000000" tinybar; "0.01" USDC -> "10000". */
export function toAtomic(amount: string | number, decimals: number): string {
  const text = String(amount).trim();
  if (!/^\d+(\.\d+)?$/.test(text)) throw new Error(`Not an amount: "${text}"`);
  const [whole, fraction = ""] = text.split(".");
  if (fraction.length > decimals) {
    throw new Error(`"${text}" has more than ${decimals} decimals`);
  }
  return (BigInt(whole + fraction.padEnd(decimals, "0"))).toString();
}

export function explorerUrl(network: string, transaction: string): string | null {
  if (network === HEDERA_NETWORK) {
    // Hedera reports "0.0.7162784@1788793434.486458284"; HashScan wants dashes.
    const m = transaction.match(/(\d+\.\d+\.\d+)@(\d+)\.(\d+)/);
    if (!m) return null;
    return `https://hashscan.io/testnet/transaction/${m[1]}-${m[2]}-${m[3]}`;
  }
  if (network === ARC_NETWORK && transaction.startsWith("0x")) {
    return `https://explorer.testnet.arc.network/tx/${transaction}`;
  }
  return null;
}
