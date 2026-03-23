import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/restaurante/", "/api/"],
    },
    sitemap: "https://menusanjuan.com/sitemap.xml",
  };
}
