/**
 * Production origin for canonical URLs and structured data (plan §6: never derived from the request host).
 * Priority: explicit NEXT_PUBLIC_SITE_URL → Vercel's production URL for this project → localhost in dev.
 */
const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL;
// `||`, not `??`: a variable left empty in .env.local (as .env.example suggests for previews) must fall through, not become an empty address.
export const siteUrl = (explicit || (vercelProd ? `https://${vercelProd}` : "http://localhost:3000")).replace(/\/$/, "");
