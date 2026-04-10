import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const withNextIntl = createNextIntlPlugin();
const projectRoot = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  // Set output to standalone for production deployments
  output: 'standalone',
  outputFileTracingRoot: projectRoot,
};

export default withNextIntl(nextConfig);
