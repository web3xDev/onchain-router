import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildListing, probeEndpoint } from "@/lib/listing";

/**
 * Listing over HTTP, for agents and scripts.
 *
 * Same steps as the page: the endpoint is probed for its 402, and a passing probe
 * becomes a listing request. Nothing is stored; the response carries a prefilled
 * GitHub issue URL to open, and the registry entry a pull request would add. Either
 * one, reviewed and merged, puts the tool in the catalogue and over MCP.
 */
const schema = z.object({
  endpoint: z.string().url(),
  name: z.string().min(2).max(60),
  question: z.string().min(8).max(200).describe("One sentence: what the caller learns or gets"),
  example: z.record(z.string(), z.unknown()).optional().describe("Sample request body"),
  category: z.string().max(30).optional(),
  inputs: z.string().max(600).optional().describe("One per line, name: meaning"),
  contact: z.string().max(80).optional(),
});

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
  }

  const probe = await probeEndpoint(parsed.data.endpoint, parsed.data.example ?? {});
  if (!probe.ok) return NextResponse.json({ ok: false, error: probe.error }, { status: 422 });

  const listing = buildListing(parsed.data, probe);
  return NextResponse.json({
    ok: true,
    ...listing,
    next: "Open issueUrl (a prefilled GitHub issue), or send a pull request adding registryEntry to lib/tools/registry.ts. A maintainer reviews it; once merged the tool is live in the catalogue and over MCP.",
  });
}
