import dotenv from "dotenv";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { wrapMCPClientWithPayment } from "@x402/mcp";
import { paymentClientFromEnv } from "@/lib/payment/agent-wallet";

dotenv.config({ path: ".env.local" });
dotenv.config();

/**
 * Acts as someone else's agent connecting to the router by URL.
 *
 * No clone, no local server: one HTTP endpoint, a wallet of its own, and the x402
 * MCP client handling the payment-required error underneath. This is the arrangement
 * the site describes as "connect once", and this script is what proves it works.
 */

const MCP_URL = process.env.ONCHAIN_ROUTER_MCP_URL ?? "http://localhost:3000/mcp";
const TOOL = process.env.MCP_TOOL ?? "lending_rates";
const ARGS = JSON.parse(process.env.MCP_ARGS ?? '{"asset":"USDC","chain":"ethereum"}');

async function main() {
  const payment = paymentClientFromEnv({ preferNetwork: process.env.PAY_NETWORK });
  if (!payment) {
    console.error("No wallet configured. Fill in .env.local; this agent needs something to pay with.");
    process.exit(1);
  }

  const mcp = new Client({ name: "remote-check", version: "0.1.0" });
  const agent = wrapMCPClientWithPayment(mcp, payment.client, {
    onPaymentRequested: ({ toolName, paymentRequired }) => {
      const offered = paymentRequired.accepts.map((a) => `${a.network} ${a.amount}`).join(", ");
      console.log(`402 from ${toolName}. Offered: ${offered}. Paying.`);
      return true;
    },
  });

  console.log(`url     : ${MCP_URL}`);
  console.log(`wallet  : ${payment.describe}`);

  await agent.connect(new StreamableHTTPClientTransport(new URL(MCP_URL)));

  const { tools } = await agent.listTools();
  console.log(`tools   : ${tools.map((t) => t.name).join(", ")}`);
  console.log(`calling : ${TOOL} ${JSON.stringify(ARGS)}`);
  console.log("");

  const result = await agent.callTool(TOOL, ARGS);

  console.log(`paid    : ${result.paymentMade}`);
  if (result.paymentResponse) {
    console.log(`settled : ${result.paymentResponse.success}`);
    console.log(`payer   : ${result.paymentResponse.payer}`);
    console.log(`network : ${result.paymentResponse.network}`);
    console.log(`tx      : ${result.paymentResponse.transaction}`);
  }

  const text = result.content.find((c) => c.type === "text") as { text?: string } | undefined;
  if (text?.text) {
    try {
      const data = JSON.parse(text.text) as { assessment?: string };
      console.log(`answer  : ${data.assessment ?? text.text.slice(0, 300)}`);
    } catch {
      console.log(`answer  : ${text.text.slice(0, 300)}`);
    }
  }

  await agent.close();
  if (result.isError) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
