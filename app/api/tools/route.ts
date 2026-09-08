import { NextResponse } from "next/server";
import { catalogue, CATEGORIES } from "@/lib/tools/registry";

/**
 * The catalogue. Free to read: you pay to call a tool, not to find out one exists.
 *
 * The site renders from this, and so can any agent that wants to know what is on
 * offer before committing to a payment.
 */
export async function GET() {
  return NextResponse.json({
    tools: catalogue(),
    categories: CATEGORIES,
  });
}
