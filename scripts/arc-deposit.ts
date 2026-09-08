import dotenv from "dotenv";
import { GatewayClient } from "@circle-fin/x402-batching/client";

dotenv.config({ path: ".env.local" });
dotenv.config();

/**
 * Moves USDC from the agent's Arc wallet into its Gateway balance.
 *
 * Gateway payments draw on a balance held inside the Gateway contract, not on the
 * wallet balance. USDC sitting in the wallet is not spendable over x402 until it has
 * been deposited once: the deposit costs gas, every payment afterwards does not.
 *
 *   npm run arc:deposit          deposits 5 USDC
 *   npm run arc:deposit 12.5     deposits 12.5 USDC
 */

const CHAIN = "arcTestnet" as const;
const DEFAULT_AMOUNT = "5";

/** Balances come back with BigInt fields, which JSON.stringify refuses to serialize. */
function show(value: unknown): string {
  return JSON.stringify(value, (_key, v) => (typeof v === "bigint" ? v.toString() : v));
}

async function main() {
  const privateKey = process.env.ARC_AGENT_PRIVATE_KEY;
  if (!privateKey) {
    console.error("Missing ARC_AGENT_PRIVATE_KEY in .env.local");
    process.exit(1);
  }

  const amount = process.argv[2] ?? DEFAULT_AMOUNT;

  const client = new GatewayClient({
    chain: CHAIN,
    privateKey: privateKey as `0x${string}`,
  });

  // When a Circle agent wallet is configured, the balance is credited to it rather
  // than to the key doing the depositing. Gateway lets one address fund another's
  // balance, so the Circle wallet never needs USDC or gas of its own, it only ever
  // signs. In production the agent wallet would be funded directly; here the local
  // key pays so the wallet under Circle's custody stays a pure signer.
  const beneficiary = process.env.CIRCLE_WALLET_ADDRESS as `0x${string}` | undefined;

  const before = await client.getUsdcBalance();
  console.log("wallet USDC  :", show(before));

  const balanceBefore = await client
    .getBalance(beneficiary)
    .catch(() => null);
  console.log("gateway (pre):", balanceBefore ? show(balanceBefore) : "none yet");
  console.log("");

  if (beneficiary) {
    console.log(`depositing ${amount} USDC for the Circle agent wallet ${beneficiary}...`);
  } else {
    console.log(`depositing ${amount} USDC...`);
  }

  const result = beneficiary
    ? await client.depositFor(amount, beneficiary)
    : await client.deposit(amount);

  if (result.approvalTxHash) {
    console.log("approval     :", result.approvalTxHash);
  }
  console.log("deposit tx   :", result.depositTxHash);
  console.log("explorer     :", `https://explorer.testnet.arc.network/tx/${result.depositTxHash}`);
  console.log("");

  // The Gateway API can lag the on-chain deposit by a few seconds.
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const balance = await client.getBalance(beneficiary).catch(() => null);
    if (balance && show(balance) !== show(balanceBefore)) {
      console.log("gateway      :", show(balance));
      console.log("");
      console.log("Ready. Now: PAY_NETWORK=eip155:5042002 npm run pay");
      return;
    }
    if (attempt < 6) await new Promise((r) => setTimeout(r, 5000));
  }

  console.log("Deposit sent, but the Gateway balance has not appeared yet.");
  console.log("Wait a moment and re-check, or just try the payment.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
