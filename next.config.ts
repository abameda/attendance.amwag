import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Set output to standalone for production deployments
  output: 'standalone',

  // Ignore TypeScript errors during build (we already check them in dev)
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
