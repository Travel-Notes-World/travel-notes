import { withPayload } from "@payloadcms/next/withPayload";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

// withPayload lets the CMS admin panel and API run inside this Next.js app.
export default withPayload(nextConfig, { devBundleServerPackages: false });
