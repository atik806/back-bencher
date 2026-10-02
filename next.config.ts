import type { NextConfig } from "next";

// Empty for local dev; set to "/games/back-bencher" by `npm run build:vibeflow`
// so the static export can be served from a sub-path of vibeflow.tech.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
  basePath,
  assetPrefix: basePath,
};

export default nextConfig;
