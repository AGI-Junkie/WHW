import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security/headers";

const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // A self-contained server.js + traced node_modules, for running on a plain Node/Docker host.
  output: "standalone",
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders(isDev) }];
  },
};

export default nextConfig;
