import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { agentWalletFromEnv, type Settlement } from "@/lib/payment/agent-wallet";
import { findTool } from "@/lib/tools/registry";
import { HEDERA_NETWORK, ARC_NETWORK } from "@/lib/x402";

/**
 * The playground, and the only place the router spends its own money.
 *
 * Everywhere else the calling agent pays from its own wallet. Here a demo wallet we
 * fund makes the payment, so someone can watch a real settlement without first
 * getting testnet funds. The payment is real; only the payer is ours.
 *
 * Because it is our money, it is capped: a handful of calls per visitor and a ceiling
 * for the whole deployment per day.
 */

const PER_VISITOR = Number(process.env.PLAYGROUND_PER_VISITOR ?? 8);
const PER_DAY = Number(process.env.PLAYGROUND_PER_DAY ?? 400);
const WINDOW_MS = 60 * 60 * 1000;

type Bucket = { count: number; resetAt: number };

// In memory on purpose. It resets on redeploy, which is the right trade for a demo
// budget: the ceiling exists to stop a script draining the wallet, not to bill anyone.
const visitors = new Map<string, Bucket>();
const day: Bucket = { count: 0, resetAt: Date.now() + 24 * 60 * 60 * 1000 };

function take(bucket: Bucket, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

function visitorOf(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "local";
}

function explorer(settlement: Settlement): string | null {
  const tx = String(settlement.transaction ?? "");

  // Hedera reports "0.0.7162784@1788793434.486458284"; HashScan wants dashes.
  const hedera = tx.match(/(\d+\.\d+\.\d+)@(\d+)\.(\d+)/);
  if (hedera) {
    const [, account, seconds, nanos] = hedera;
    return `https://hashscan.io/testnet/transaction/${account}-${seconds}-${nanos}`;
  }

  if (tx.startsWith("0x")) return `https://explorer.testnet.arc.network/tx/${tx}`;
  return null;
}

const requestSchema = z.object({
  slug: z.string(),
  input: z.record(z.string(), z.unknown()).default({}),
  network: z.enum([HEDERA_NETWORK, ARC_NETWORK]).optional(),
});

export async function POST(request: NextRequest) {
  const parsedRequest = requestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsedRequest.success) {
    return NextResponse.json({ error: "Malformed request" }, { status: 400 });
  }

  const { slug, input, network } = parsedRequest.data;
  const tool = findTool(slug);
  if (!tool) return NextResponse.json({ error: `Unknown tool "${slug}"` }, { status: 404 });

  const parsedInput = z.object(tool.inputSchema).safeParse(input);
  if (!parsedInput.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsedInput.error.issues },
      { status: 400 },
    );
  }

  const visitorKey = visitorOf(request);
  const visitor = visitors.get(visitorKey) ?? { count: 0, resetAt: Date.now() + WINDOW_MS };
  visitors.set(visitorKey, visitor);

  if (!take(visitor, PER_VISITOR, WINDOW_MS)) {
    return NextResponse.json(
      {
        error: `The demo wallet allows ${PER_VISITOR} calls an hour. Connect your own agent to keep going.`,
      },
      { status: 429 },
    );
  }

  if (!take(day, PER_DAY, 24 * 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "The demo wallet is out of budget for today. Connect your own agent instead." },
      { status: 429 },
    );
  }

  const origin = new URL(request.url).origin;
  const startedAt = Date.now();

  // Progress is streamed as it happens, one JSON object per line. Each event comes
  // from a real hook on the payment client, so the timing the viewer sees is the
  // timing the payment actually had.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(JSON.stringify({ ...event, t: Date.now() - startedAt }) + "\n"));

      let settlement: Settlement | null = null;
      const wallet = agentWalletFromEnv({
        preferNetwork: network,
        onQuote: (quote) => emit({ type: "quote", ...quote }),
        onSigned: (signed) => emit({ type: "signed", ...signed }),
        onSettle: (result) => {
          settlement = result;
        },
      });

      if (!wallet) {
        emit({ type: "error", error: "No demo wallet configured on this deployment." });
        controller.close();
        return;
      }

      emit({ type: "request", slug, input: parsedInput.data });

      try {
        const response = await wallet.fetch(`${origin}/api/tools/${slug}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsedInput.data),
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          const body = data as { answer?: null; reason?: string; error?: string } | null;
          const noAnswer = response.status === 404 && body?.answer === null;
          emit({
            type: noAnswer ? "no-answer" : "error",
            error: noAnswer
              ? `No answer, so nothing was charged. ${body?.reason ?? ""}`.trim()
              : `The tool did not answer (${body?.error ?? response.status}). Nothing was charged.`,
          });
          controller.close();
          return;
        }

        const receipt = settlement as Settlement | null;
        if (receipt) {
          emit({
            type: "settled",
            settled: receipt.success !== false,
            network: receipt.network ?? null,
            payer: receipt.payer ?? null,
            transaction: receipt.transaction ?? null,
            explorer: explorer(receipt),
          });
        }

        emit({ type: "answer", ms: Date.now() - startedAt, data });
      } catch (error) {
        emit({ type: "error", error: error instanceof Error ? error.message : "Request failed" });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" },
  });
}
