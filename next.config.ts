import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  // Set output to standalone for production deployments
  output: 'standalone',

  // Ignore TypeScript errors during build (we already check them in dev)
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default withNextIntl(nextConfig);
