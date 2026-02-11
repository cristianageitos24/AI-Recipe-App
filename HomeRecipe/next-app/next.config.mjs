import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 16 uses Turbopack by default; empty config satisfies the build when webpack is also set
  turbopack: {},
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
    // When middleware (proxy) runs, Next.js buffers the body; default 10MB truncates ~13MB+ uploads
    proxyClientMaxBodySize: "50mb",
  },
  webpack: (config, { isServer }) => {
    // Prefer next-app/node_modules so tailwindcss and deps resolve here when Webpack is used (e.g. PostCSS pipeline).
    config.resolve.modules = [
      path.join(__dirname, "node_modules"),
      ...(config.resolve.modules || []),
    ];

    // Ensure @/* path alias works - preserve existing aliases that Next.js sets up from tsconfig.json
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(__dirname),
    };

    return config;
  },
};

export default nextConfig;
