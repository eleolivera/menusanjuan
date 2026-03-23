import { notFound } from "next/navigation";
import Image from "next/image";
import { DEMO_RESTAURANTS } from "@/data/restaurants";
import { getRestaurantBySlug } from "@/lib/get-restaurant";
import { getMenuBySlug } from "@/lib/get-restaurant-menu";
import { StoreMenu } from "@/components/StoreMenu";

export async function generateStaticParams() {
  return DEMO_RESTAURANTS.map((r) => ({ store: r.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ store: string }>;
}) {
  const { store } = await params;
  const restaurant = await getRestaurantBySlug(store);
  if (!restaurant) return { title: "No encontrado" };

  return {
    title: `${restaurant.name} — Menú`,
    description: restaurant.description,
    openGraph: {
      title: `${restaurant.name} — Menú | MenuSanJuan`,
      description: restaurant.description,
      images: [{ url: restaurant.coverUrl, width: 800, height: 400 }],
      type: "website",
    },
  };
}

export default async function StorePage({
  params,
}: {
  params: Promise<{ store: string }>;
}) {
  const { store } = await params;
  const restaurant = await getRestaurantBySlug(store);

  if (!restaurant) notFound();

  const categories = await getMenuBySlug(restaurant.slug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: restaurant.name,
    url: `https://menusanjuan.com/${restaurant.slug}`,
    image: restaurant.coverUrl,
    servesCuisine: restaurant.cuisineType,
    telephone: restaurant.phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: restaurant.address,
      addressLocality: "San Juan",
      addressRegion: "San Juan",
      addressCountry: "AR",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: restaurant.rating,
      bestRating: 5,
      ratingCount: restaurant.itemCount,
    },
    hasMenu: {
      "@type": "Menu",
      hasMenuSection: categories.map((cat) => ({
        "@type": "MenuSection",
        name: cat.name,
        hasMenuItem: cat.items.map((item) => ({
          "@type": "MenuItem",
          name: item.name,
          description: item.description,
          offers: {
            "@type": "Offer",
            price: item.price,
            priceCurrency: "ARS",
          },
        })),
      })),
    },
  };

  return (
    <div className="mesh-gradient min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Store Header / Cover */}
      <div className="relative h-48 sm:h-56 overflow-hidden bg-gradient-to-br from-slate-900 via-orange-950 to-red-950">
        <Image
          src={restaurant.coverUrl}
          alt={restaurant.name}
          fill
          className="object-cover opacity-40"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 px-4 pb-5">
          <div className="mx-auto max-w-7xl">
            <div className="flex items-end gap-4">
              {/* Logo */}
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-amber-500 text-white text-2xl font-bold shadow-lg border-2 border-white/20">
                {restaurant.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight truncate">
                  {restaurant.name}
                </h1>
                <div className="flex items-center gap-3 mt-1">
                  <span className="rounded-lg bg-primary/90 px-2 py-0.5 text-xs font-medium text-white">
                    {restaurant.cuisineType}
                  </span>
                  <div className="flex items-center gap-1">
                    <svg className="h-4 w-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span className="text-sm font-semibold text-white">{restaurant.rating}</span>
                  </div>
                  <span
                    className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${
                      restaurant.isOpen
                        ? "bg-emerald-500/90 text-white"
                        : "bg-slate-600/80 text-slate-300"
                    }`}
                  >
                    {restaurant.isOpen ? "Abierto" : "Cerrado"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Restaurant Info Bar */}
      <div className="border-b border-border/30 bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <p className="text-sm text-text-secondary leading-relaxed">
            {restaurant.description}
          </p>
          <div className="flex items-center gap-4 mt-2 text-xs text-text-muted">
            <span className="flex items-center gap-1">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              {restaurant.address}
            </span>
            <span>{restaurant.itemCount} productos</span>
            <span>{restaurant.priceRange}</span>
          </div>
        </div>
      </div>

      {/* Menu */}
      <StoreMenu restaurant={restaurant} categories={categories} />
    </div>
  );
}
