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

export const SITE_NAME = "OnchainRouter";
export const SITE_TAGLINE = "Onchain tools for AI agents";
export const SITE_DESCRIPTION =
  "Call an onchain tool, pay a cent, get the result. No account, no API key, no subscription. No answer, no charge.";
