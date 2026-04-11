import type { NextConfig } from "next";
import { publicSupabaseEnv } from "./src/lib/supabase/config";

const nextConfig: NextConfig = {
  env: publicSupabaseEnv,
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  async redirects() {
    return [
      {
        source: '/app',
        destination: '/feed',
        permanent: false,
      },
      {
        source: '/app/:path*',
        destination: '/:path*',
        permanent: false,
      },
      {
        source: '/privacy',
        destination: '/privacy-policy.html',
        permanent: false,
      },
      {
        source: '/terms',
        destination: '/terms-of-service.html',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
