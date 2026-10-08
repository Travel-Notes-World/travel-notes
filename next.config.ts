import { withPayload } from "@payloadcms/next/withPayload";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Member photos are sent through a server action. They are capped at 4 MB
      // (LIMITS.uploadMaxBytes, below Vercel's 4.5 MB request limit) and made smaller in the
      // browser first; this leaves room for the multipart form overhead.
      bodySizeLimit: "5mb",
    },
  },
};

// withPayload lets the CMS admin panel and API run inside this Next.js app.
export default withPayload(nextConfig, { devBundleServerPackages: false });
