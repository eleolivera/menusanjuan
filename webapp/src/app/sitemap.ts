import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://menusanjuan.com";

  const dealers = await prisma.dealer.findMany({
    where: { isActive: true },
    select: { slug: true, updatedAt: true },
  });

  const restaurantPages = dealers.map((d) => ({
    url: `${baseUrl}/${d.slug}`,
    lastModified: d.updatedAt,
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
