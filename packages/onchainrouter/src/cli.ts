#!/usr/bin/env node
import { serveWallet } from "./wallet.js";

const USAGE = `onchainrouter

  onchainrouter wallet    run the agent wallet as an MCP server on stdio

Keys come from the environment:
  HEDERA_AGENT_ACCOUNT_ID, HEDERA_AGENT_PRIVATE_KEY        Hedera, local ECDSA key
  ARC_AGENT_PRIVATE_KEY                                     Arc, local key
  CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET,
  CIRCLE_WALLET_ID, CIRCLE_WALLET_ADDRESS                   Arc, Circle agent wallet

Register it beside a paid MCP server, e.g. in Claude Code:
  claude mcp add --transport http onchainrouter https://onchainrouter.io/mcp
  claude mcp add onchain-wallet -e HEDERA_AGENT_ACCOUNT_ID=0.0.x -e HEDERA_AGENT_PRIVATE_KEY=0x... \\
    -e ARC_AGENT_PRIVATE_KEY=0x... -- npx -y onchainrouter wallet
`;

const [, , command] = process.argv;

if (command === "wallet") {
  serveWallet().catch((error) => {
    console.error(error);
    process.exit(1);
  });
} else {
  process.stdout.write(USAGE);
  process.exit(command === undefined || command === "help" || command === "--help" ? 0 : 1);
}
