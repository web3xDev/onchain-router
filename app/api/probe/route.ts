import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { probeEndpoint } from "@/lib/listing";

/**
 * Checks that a URL is an x402 endpoint before it is listed: one unpaid request,
 * and the 402 read back for price, rails and payout. The logic lives in lib/listing.
 */
const schema = z.object({
  url: z.string().url(),
  /** A sample request body, for endpoints that validate input before quoting. */
  input: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Not a URL." }, { status: 400 });

  const result = await probeEndpoint(parsed.data.url, parsed.data.input ?? {});
  return NextResponse.json(result, { status: result.ok ? 200 : 200 });
}
