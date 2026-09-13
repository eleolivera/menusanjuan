import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // The promo-creative route loads Inter via readFileSync(process.cwd() +
  // "/public/fonts/…") for satori. Standalone tracing can't see dynamic fs
  // paths, so force-include the font files into that route's bundle —
  // otherwise it 500s with ENOENT on Vercel while working fine locally.
  outputFileTracingIncludes: {
    "/api/restaurante/promocionar/creative": ["./public/fonts/**/*"],
  },
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
