import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { createSecurityHeaders } from "./lib/security-headers";

const isDevelopment = process.env.NODE_ENV === "development";
const isProduction = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.0.177"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: createSecurityHeaders({ isDevelopment, isProduction }),
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "tsrsncnraamnhcfyyxlg.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/products/**",
        search: "",
      },
    ],
  },
};

export default nextConfig;

initOpenNextCloudflareForDev();
