import type { NextConfig } from "next";
import { publicSupabaseEnv } from "./src/lib/supabase/config";

const nextConfig: NextConfig = {
  basePath: '/app',
  env: publicSupabaseEnv,
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
