import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pg", "unpdf", "mammoth"],
  // Tab switches currently refetch every dynamic page (Next 15 default staleTime is 0).
  // 30s lets going back to a just-visited tab feel instant without serving stale figures for long.
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  outputFileTracingIncludes: {
    "*": ["./migrations/**/*"],
  },
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
