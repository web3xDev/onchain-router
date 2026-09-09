/**
 * Where this deployment lives.
 *
 * Metadata needs an absolute URL and so do the copy-paste curl examples, so the
 * address is worked out once rather than hardcoded in each place. Set
 * NEXT_PUBLIC_SITE_URL on the deployment; Vercel's own variable is the fallback so a
 * preview build links to itself rather than to production.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}

export const SITE_NAME = "Onchain Router";
export const SITE_TAGLINE = "The OpenRouter for onchain tools";
export const SITE_DESCRIPTION =
  "AI agents discover onchain tools, call them over MCP and pay per call with x402. No account, no API key, no subscription.";
