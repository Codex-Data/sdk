import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'token-media.defined.fi',
      },
    ],
  },
};

export default nextConfig;
