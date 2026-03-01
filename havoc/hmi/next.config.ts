import type { NextConfig } from "next";

const backendUrl = process.env.NEXT_PUBLIC_HAVOC_URL || "http://localhost:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${backendUrl}/:path*` },
    ];
  },
};

export default nextConfig;
