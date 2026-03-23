import type { MetadataRoute } from "next";
import { DEMO_RESTAURANTS } from "@/data/restaurants";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://menusanjuan.com";

  const restaurantPages = DEMO_RESTAURANTS.map((r) => ({
    url: `${baseUrl}/${r.slug}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    ...restaurantPages,
  ];
}
