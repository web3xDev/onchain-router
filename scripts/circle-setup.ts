import dotenv from "dotenv";
import fs from "node:fs";
import crypto from "node:crypto";
import {
  initiateDeveloperControlledWalletsClient,
  registerEntitySecretCiphertext,
} from "@circle-fin/developer-controlled-wallets";

dotenv.config({ path: ".env.local" });
dotenv.config();

/**
 * Sets up a Circle agent wallet on Arc testnet, once.
 *
 * Needs only CIRCLE_API_KEY. Generates an entity secret, registers it, creates a
 * wallet set and an EOA wallet on ARC-TESTNET, then writes the results into
 * .env.local so the Arc rail starts signing through Circle instead of a local key.
 *
 * The entity secret can only be registered once per Circle account. If yours is
 * already registered, set CIRCLE_ENTITY_SECRET yourself and this script will skip
 * ahead to creating the wallet.
 */

const ENV_FILE = ".env.local";
const RECOVERY_DIR = "circle-recovery";

function setEnvVar(name: string, value: string) {
  let contents = fs.readFileSync(ENV_FILE, "utf8");
  const line = `${name}=${value}`;
  contents = new RegExp(`^${name}=.*$`, "m").test(contents)
    ? contents.replace(new RegExp(`^${name}=.*$`, "m"), line)
    : `${contents.trimEnd()}\n${line}\n`;
  fs.writeFileSync(ENV_FILE, contents);
}

async function main() {
  const apiKey = process.env.CIRCLE_API_KEY;
  if (!apiKey) {
    console.error("Set CIRCLE_API_KEY in .env.local first (console.circle.com).");
    process.exit(1);
  }

  // ── Entity secret ──────────────────────────────────────────────────────────
  let entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (entitySecret) {
    console.log("entity secret : already set, reusing");
  } else {
    entitySecret = crypto.randomBytes(32).toString("hex");

    // Persist before registering. Registration can succeed and still fail on the way
    // back (writing the recovery file, say) and a secret that Circle has accepted
    // but we never wrote down is unrecoverable.
    setEnvVar("CIRCLE_ENTITY_SECRET", entitySecret);
    console.log("entity secret : generated and saved to .env.local");

    fs.mkdirSync(RECOVERY_DIR, { recursive: true });

    try {
      await registerEntitySecretCiphertext({
        apiKey,
        entitySecret,
        recoveryFileDownloadPath: RECOVERY_DIR,
      });
      console.log(`registered    : recovery file written under ${RECOVERY_DIR}/`);
      console.log("                keep it, it is the only way to recover the secret");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`\nCould not register the entity secret: ${message}`);
      console.error("");
      console.error("The secret is saved in .env.local either way. If Circle says one is");
      console.error("already registered, either reuse that secret or reset it in the");
      console.error("Circle console, then run this again.");
      process.exit(1);
    }
  }

  const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });

  // ── Wallet set ─────────────────────────────────────────────────────────────
  const walletSet = await client.createWalletSet({ name: "onchain-router" });
  const walletSetId = walletSet.data?.walletSet?.id;
  if (!walletSetId) throw new Error("Circle returned no wallet set id");
  console.log(`wallet set    : ${walletSetId}`);

  // ── Wallet ─────────────────────────────────────────────────────────────────
  // EOA rather than SCA: Gateway verifies an ECDSA signature.
  const created = await client.createWallets({
    walletSetId,
    blockchains: ["ARC-TESTNET"],
    accountType: "EOA",
    count: 1,
  });

  const wallet = created.data?.wallets?.[0];
  if (!wallet?.id || !wallet.address) throw new Error("Circle returned no wallet");

  setEnvVar("CIRCLE_WALLET_ID", wallet.id);
  setEnvVar("CIRCLE_WALLET_ADDRESS", wallet.address);

  console.log(`wallet id     : ${wallet.id}`);
  console.log(`address       : ${wallet.address}`);
  console.log("");
  console.log("Written to .env.local. Next:");
  console.log("  1. Send Arc testnet USDC to that address (faucet.circle.com)");
  console.log("  2. npm run arc:deposit          move it into the Gateway balance");
  console.log("  3. PAY_NETWORK=eip155:5042002 npm run pay");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
