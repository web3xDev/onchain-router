import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/**
 * Plays a chat client that cannot sign, with a wallet MCP beside it.
 *
 * No x402 library on this side at all: a plain MCP client talks to the remote router
 * and to the wallet server, and does the three steps a model would do from the text
 * it is shown. Call the tool, get told to pay, ask the wallet to sign, call again with
 * the signature. If this works, Claude with the same two servers works.
 */

const MCP_URL = process.env.ONCHAIN_ROUTER_MCP_URL ?? "http://localhost:3000/mcp";
const TOOL = process.env.MCP_TOOL ?? "lending_rates";
const ARGS = JSON.parse(process.env.MCP_ARGS ?? '{"asset":"USDC","chain":"ethereum"}');

type Text = { type: string; text?: string };

function firstText(result: unknown): string {
  const items = ((result as { content?: unknown }).content ?? []) as Text[];
  return items.find((c) => c.type === "text")?.text ?? "";
}

async function main() {
  const router = new Client({ name: "chat-client", version: "0.1.0" });
  await router.connect(new StreamableHTTPClientTransport(new URL(MCP_URL)));

  // The wallet is launched the way a chat client would launch it: as its own process.
  const wallet = new Client({ name: "chat-client", version: "0.1.0" });
  await wallet.connect(
    new StdioClientTransport({ command: "npx", args: ["tsx", "mcp/wallet.ts"], stderr: "pipe" }),
  );

  const info = await wallet.callTool({ name: "wallet_info", arguments: {} });
  console.log(`wallet  : ${firstText(info)}`);
  console.log(`router  : ${MCP_URL}`);
  console.log("");

  // 1. Call the tool. Expect to be told to pay.
  console.log(`1. call ${TOOL} ${JSON.stringify(ARGS)}`);
  const first = await router.callTool({ name: TOOL, arguments: ARGS });
  const items = (first.content ?? []) as Text[];
  const hint = items[1]?.text ?? "";
  console.log(`   ${first.isError ? "payment required" : "answered without payment?!"}`);
  if (hint) console.log(`   ${hint.split(". ")[0]}.`);

  if (!first.isError) {
    console.log("   unexpected: the tool answered for free");
    process.exit(1);
  }

  // 2. Hand the payment request to the wallet.
  console.log("2. sign with wallet");
  const signed = await wallet.callTool({
    name: "sign_x402_payment",
    arguments: { paymentRequired: firstText(first), network: process.env.PAY_NETWORK },
  });
  if (signed.isError) {
    console.log(`   wallet refused: ${firstText(signed)}`);
    process.exit(1);
  }
  const receipt = JSON.parse(firstText(signed)) as { payment: string; network: string; amount: string };
  console.log(`   signed on ${receipt.network}, ${receipt.amount}`);

  // 3. Call again with the signature as a plain argument.
  console.log("3. call again with payment");
  const second = await router.callTool({
    name: TOOL,
    arguments: { ...ARGS, payment: receipt.payment },
  });

  if (second.isError) {
    console.log(`   still refused: ${firstText(second).slice(0, 300)}`);
    process.exit(1);
  }

  const settle = (second._meta as Record<string, unknown> | undefined)?.["x402/payment-response"] as
    | { success?: boolean; payer?: string; network?: string; transaction?: string }
    | undefined;

  if (settle) {
    console.log(`   settled : ${settle.success} on ${settle.network} by ${settle.payer}`);
    console.log(`   tx      : ${settle.transaction}`);
  }

  const data = JSON.parse(firstText(second)) as { assessment?: string };
  console.log(`   answer  : ${data.assessment}`);

  await router.close();
  await wallet.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
