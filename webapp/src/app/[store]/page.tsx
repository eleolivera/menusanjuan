import { notFound } from "next/navigation";
import Image from "next/image";
import { getRestaurantBySlug } from "@/lib/get-restaurant";
import { getMenuBySlug } from "@/lib/get-restaurant-menu";
import { StoreMenu } from "@/components/StoreMenu";
import { RewardBadge } from "@/components/RewardBadge";
import { ClaimBanner } from "@/components/ClaimBanner";
import { coverGradient } from "@/lib/gradients";
import { Star, Clock, MapPin } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ store: string }>;
}) {
  const { store } = await params;
  const restaurant = await getRestaurantBySlug(store);
  if (!restaurant) return { title: "No encontrado" };

  // WhatsApp link previews look way better with a square brand logo in the
  // small thumb slot than a wide cover (most covers get cropped or skipped
  // entirely if over ~600KB). Prefer the logo; fall back to the cover; if
  // neither is set, fall back to the platform brand mark so the preview is
  // never blank / a black triangle.
  const ogImage = restaurant.logoUrl || restaurant.coverUrl || "https://menusanjuan.com/icon-512.png";
  const ogTitle = `${restaurant.name} — Menú | MenuSanJuan`;
  const ogDescription = restaurant.description ?? undefined;

  // Per-resta favicon — the browser tab + bookmark + iOS home-screen icon
  // shows the RESTAURANT'S logo instead of inheriting the platform default.
  // When logoUrl is null, we fall back to the platform icon.
  const tabIcon = restaurant.logoUrl || "/favicon.ico";
  const appleIcon = restaurant.logoUrl || "/apple-touch-icon.png";

  return {
    title: `${restaurant.name} — Menú`,
    description: restaurant.description,
    icons: {
      icon: tabIcon,
      shortcut: tabIcon,
      apple: appleIcon,
    },
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      images: [{ url: ogImage }],
      type: "website",
    },
    // Override the root-layout twitter defaults so iMessage / Twitter / Telegram
    // unfurls show the dealer's brand instead of the generic site card.
    twitter: {
      card: "summary",
      title: ogTitle,
      description: ogDescription,
      images: [ogImage],
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
    ...(restaurant.coverUrl ? { image: restaurant.coverUrl } : {}),
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

  const ps = (restaurant as any).pickupService;
  const ds = (restaurant as any).deliveryService;
  const allClosed = ps && ds && !ps.available && !ds.available;
  const nextOpen = ps?.nextOpenLabel || ds?.nextOpenLabel;

  return (
    <div className="mesh-gradient min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Closed banner — both services unavailable */}
      {allClosed && (
        <div className="sticky top-0 z-20 bg-amber-100 border-b border-amber-300 px-4 py-2.5 text-center text-sm font-medium text-amber-900">
          <span>🌙 Estamos cerrados ahora</span>
          {nextOpen && <span className="text-amber-700"> · abrimos {nextOpen}</span>}
          <span className="block text-[11px] text-amber-700/80 mt-0.5">Podés armar tu pedido — el carrito se guarda hasta que abramos.</span>
        </div>
      )}

      {/* Store Header / Cover */}
      <div className={`relative h-48 sm:h-56 overflow-hidden ${!restaurant.coverUrl ? coverGradient(restaurant.name) : "bg-slate-900"}`}>
        {restaurant.coverUrl && (
          <Image
            src={restaurant.coverUrl}
            alt={restaurant.name}
            fill
            className="object-cover opacity-40"
            priority
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 px-4 pb-5">
          <div className="mx-auto max-w-7xl">
            <div className="flex items-end gap-4">
              {/* Logo */}
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-amber-500 text-white text-2xl font-bold shadow-lg border-2 border-white/20 overflow-hidden">
                {restaurant.logoUrl ? (
                  <Image src={restaurant.logoUrl} alt="" width={64} height={64} className="h-full w-full object-cover" />
                ) : (
                  restaurant.name.charAt(0)
                )}
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
                    <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                    <span className="text-sm font-semibold text-white">{restaurant.rating}</span>
                  </div>
                  <span className="flex items-center gap-1 text-sm text-white/80">
                    <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
                    {restaurant.deliveryTimeMin ? `~${restaurant.deliveryTimeMin} min` : "Consultar"}
                  </span>
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
              <MapPin className="h-3.5 w-3.5" strokeWidth={1.5} />
              {restaurant.address}
            </span>
            <span>{restaurant.itemCount} productos</span>
            <span>{restaurant.priceRange}</span>
          </div>
        </div>
      </div>

      {/* Claim Banner — only for unclaimed/unverified restaurants with no pre-assigned owner */}
      {restaurant.dealerId && !restaurant.isVerified && !restaurant.hasPendingOwner && (
        <ClaimBanner
          dealerId={restaurant.dealerId}
          restaurantName={restaurant.name}
          slug={restaurant.slug}
        />
      )}

      {/* Rewards progress badge — client-side, reads stored phone from localStorage */}
      <RewardBadge slug={restaurant.slug} />

      {/* Menu */}
      <StoreMenu restaurant={restaurant} categories={categories} deliveryConfig={restaurant.deliveryConfig} />
    </div>
  );
}
