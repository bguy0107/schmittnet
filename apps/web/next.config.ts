import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    typedRoutes: true,
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
  transpilePackages: ["@schmittnet/types", "@schmittnet/utils"],
};

export default nextConfig;
