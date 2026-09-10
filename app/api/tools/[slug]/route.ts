import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withX402 } from "@x402/next";
import { paymentOptions, resourceServer } from "@/lib/x402";
import { findTool, TOOLS } from "@/lib/tools/registry";
import { isNoAnswer } from "@/lib/tools/no-answer";

/**
 * Every paid tool, served from one handler.
 *
 * Tools are declared in the registry, so a new capability is one entry there rather
 * than another route file, and the catalogue the site renders is guaranteed to
 * describe what this endpoint actually serves, because both read the same source.
 */
function slugOf(request: NextRequest): string {
  return new URL(request.url).pathname.split("/").pop() ?? "";
}

/** The body is read once and handed down, because a request stream only reads once. */
const handler = async (request: NextRequest): Promise<NextResponse<unknown>> => {
  const tool = findTool(slugOf(request))!;
  const input = (await request.json()) as Record<string, unknown>;

  try {
    return NextResponse.json(await tool.run(input));
  } catch (error) {
    // 4xx and up is never settled, so "no verdict" travels as 404 and costs nothing.
    // It is separated from a real failure so the caller can tell the two apart.
    if (isNoAnswer(error)) {
      return NextResponse.json(
        { answer: null, reason: error.message, charged: false },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Tool failed", charged: false },
      { status: 502 },
    );
  }
};

// One route, many tools, each paid to its own author. The address in the 402 is
// resolved from the slug in the path at request time.
const paidHandler = withX402(
  handler,
  {
    "/api/tools/[slug]": {
      accepts: paymentOptions((path) => findTool(path.split("/").pop() ?? "")?.payTo),
      description: "Onchain intelligence for agents, priced per call",
    },
  },
  resourceServer,
);

/**
 * Everything that can be answered for free is answered before the paywall.
 *
 * An unknown tool and a malformed argument both cost the caller nothing: quoting a
 * price for a call that was never going to return data would make an agent sign a
 * payment to be told it made a typo. Only a well-formed call to a real tool reaches
 * the 402.
 */
export const POST = async (request: NextRequest, context: unknown) => {
  const slug = slugOf(request);
  const tool = findTool(slug);

  if (!tool) {
    return NextResponse.json(
      { error: `Unknown tool "${slug}"`, available: TOOLS.map((t) => t.slug) },
      { status: 404 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = z.object(tool.inputSchema).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid input",
        issues: parsed.error.issues,
        expected: Object.keys(tool.inputSchema),
      },
      { status: 400 },
    );
  }

  // The stream is spent, so the validated input is re-attached for the paid handler.
  const forwarded = new NextRequest(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(parsed.data),
  });

  return (paidHandler as (r: NextRequest, c: unknown) => Promise<Response>)(forwarded, context);
};
