import { withPayload } from "@payloadcms/next/withPayload";
import type { NextConfig } from "next";

/**
 * Security headers for every page, the CMS and the API.
 *
 * - HTTPS-only (Strict-Transport-Security) is already sent by Vercel for the custom domain.
 * - Content-Security-Policy here only sets the rules that cannot break the site: who may frame it,
 *   where forms may post, no plugins, no <base> tricks, and upgrading any http:// request. Script and
 *   style rules are not set yet: a strict script policy needs a per-request nonce, which would stop
 *   pages from being cached. That decision waits until analytics and ads are chosen (plan §10:
 *   report-only first, then enforce).
 * - frame-ancestors 'self' (not 'none') so the CMS can show the site in its own preview frame later.
 */
const contentSecurityPolicy = [
  "frame-ancestors 'self'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // Older browsers that do not read frame-ancestors.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Browsers must trust the declared file type, so an uploaded file cannot be run as a script.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Other sites see only "travelnotesworld.com", never the full address of the page a visitor came from.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The site uses none of these. Turning them off means injected code cannot use them either.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
  // Pages opened from here cannot control this window.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // Do not advertise "Next.js, Payload" on every response.
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Member photos are sent through a server action. They are capped at 4 MB
      // (LIMITS.uploadMaxBytes, below Vercel's 4.5 MB request limit) and made smaller in the
      // browser first; this leaves room for the multipart form overhead.
      bodySizeLimit: "5mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

// withPayload lets the CMS admin panel and API run inside this Next.js app.
export default withPayload(nextConfig, { devBundleServerPackages: false });
