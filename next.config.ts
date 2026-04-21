import type { NextConfig } from "next";

const FRAME_ANCESTORS = [
  "'self'",
  "https://dashboard.pmpro.consulting",
  "https://*.pmpro.consulting",
].join(" ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors ${FRAME_ANCESTORS};`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
