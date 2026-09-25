/**
 * Production origin for canonical URLs and structured data (plan §6: never derived from the request host).
 * Priority: explicit NEXT_PUBLIC_SITE_URL → Vercel's production URL for this project → localhost in dev.
 */
const explicit = process.env.NEXT_PUBLIC_SITE_URL;
const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL;
export const siteUrl = (explicit ?? (vercelProd ? `https://${vercelProd}` : "http://localhost:3000")).replace(/\/$/, "");
