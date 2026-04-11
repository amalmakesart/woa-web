import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: '/app',
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
};

export default nextConfig;
