import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    // Disable Vercel's image optimization — our images are already served
    // from Cloudflare R2 (images.menusanjuan.com) which is its own CDN.
    // Running them through Vercel again costs $40+/mo for no benefit.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
