import type { NextConfig } from "next";

const isStaticExport = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  ...(isStaticExport ? { output: "export" } : {}),
  serverExternalPackages: ["node:sqlite"],
};

export default nextConfig;
