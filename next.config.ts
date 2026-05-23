import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const withNextIntl = createNextIntlPlugin();
const projectRoot = dirname(fileURLToPath(import.meta.url));

// All @react-pdf/* packages are ESM-only and depend on yoga-layout (WASM) +
// fontkit — webpack cannot bundle them and hangs trying to analyze them.
// Listing every sub-package here tells the Next.js server bundler to leave
// them all as Node.js require/import calls in the output.
const REACT_PDF_EXTERNALS = [
  '@react-pdf/renderer',
  '@react-pdf/fns',
  '@react-pdf/font',
  '@react-pdf/image',
  '@react-pdf/layout',
  '@react-pdf/pdfkit',
  '@react-pdf/primitives',
  '@react-pdf/reconciler',
  '@react-pdf/render',
  '@react-pdf/stylesheet',
  '@react-pdf/svg',
  '@react-pdf/textkit',
  '@react-pdf/types',
  'yoga-layout',
  'fontkit',
];

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: projectRoot,
  serverExternalPackages: REACT_PDF_EXTERNALS,
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Prevent webpack from ever touching react-pdf packages in the client
      // bundle — they are server-only and contain Node.js-only code.
      config.resolve = config.resolve ?? {};
      config.resolve.alias = {
        ...(config.resolve.alias as Record<string, string> | undefined),
        '@react-pdf/renderer': false,
      };
    }

    if (isServer && config.output) {
      config.output.chunkFilename = 'chunks/[name].js';
    }

    return config;
  },
};

export default withNextIntl(nextConfig);
