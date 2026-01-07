import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactCompiler: true,
  cacheComponents: true,
  serverExternalPackages: ['baileys', 'pino', 'thread-stream'],
  experimental: {
    turbopackFileSystemCacheForDev: true,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          "**/node_modules/**",
          "**/.git/**",
          "**/whatsapp_sessions/**",
          path.join(process.cwd(), "whatsapp_sessions"),
        ],
      };
    }
    return config;
  },
  /* config options here */
};

export default nextConfig;
