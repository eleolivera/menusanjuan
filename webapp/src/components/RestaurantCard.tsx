import Link from "next/link";
import Image from "next/image";
import type { Restaurant } from "@/data/restaurants";
import { coverGradient } from "@/lib/gradients";

export function RestaurantCard({
  restaurant,
  index,
}: {
  restaurant: Restaurant;
  index: number;
}) {
  return (
    <Link
      href={`/${restaurant.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-surface shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-primary/20 animate-fade-in"
      style={{
        animationDelay: `${Math.min(index * 0.03, 0.2)}s`,
        animationFillMode: "backwards",
      }}
    >
      {/* Cover Image */}
      <div className={`relative aspect-[2/1] overflow-hidden ${restaurant.coverUrl ? "bg-slate-200" : coverGradient(restaurant.name)}`}>
        {restaurant.coverUrl ? (
          <Image
            src={restaurant.coverUrl}
            alt={restaurant.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
          />
        ) : restaurant.logoUrl ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-20 w-20 rounded-2xl overflow-hidden bg-white/10 backdrop-blur-sm border border-white/20 shadow-lg">
              <Image src={restaurant.logoUrl} alt="" width={80} height={80} className="h-full w-full object-cover" />
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-5xl font-bold text-white/20">{restaurant.name.charAt(0)}</span>
          </div>
        )}
        {/* Status badge */}
        <div className="absolute top-3 left-3">
          <span
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold backdrop-blur-md ${
              restaurant.isOpen
                ? "bg-emerald-500/90 text-white"
                : "bg-slate-800/70 text-slate-300"
            }`}
          >
            {restaurant.isOpen ? "Abierto" : "Cerrado"}
          </span>
        </div>
        {/* Cuisine badges */}
        <div className="absolute top-3 right-3 flex gap-1">
          {(restaurant.cuisineTypes?.slice(0, 2) || [{ label: restaurant.cuisineType, emoji: "" }]).map((ct: any, i: number) => (
            <span key={i} className="rounded-lg bg-primary/90 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
              {ct.emoji ? `${ct.emoji} ` : ""}{ct.label}
            </span>
          ))}
          {(restaurant.cuisineTypes?.length || 0) > 2 && (
            <span className="rounded-lg bg-white/20 px-1.5 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
              +{(restaurant.cuisineTypes?.length || 0) - 2}
            </span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-base font-bold text-text leading-snug group-hover:text-primary transition-colors">
            {restaurant.name}
          </h3>
          <div className="flex items-center gap-1 shrink-0">
            <svg className="h-4 w-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className="text-sm font-semibold text-text">{restaurant.rating}</span>
          </div>
        </div>

        <p className="text-sm text-text-secondary leading-relaxed line-clamp-2 mb-3">
          {restaurant.description}
        </p>

        <div className="mt-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs text-text-muted">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              {restaurant.address.split(",")[1]?.trim() || restaurant.address}
            </span>
            <span className="text-xs text-text-muted">
              {restaurant.itemCount} productos
            </span>
          </div>
          <span className="text-xs font-semibold text-primary">
            {restaurant.priceRange}
          </span>
        </div>
      </div>
    </Link>
  );
}
