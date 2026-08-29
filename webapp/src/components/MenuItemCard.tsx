"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import type { MenuItemData } from "@/data/menus";
import { iconForItem } from "@/lib/menu-item-icon";

function isVideo(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes(".mp4") || lower.includes(".mov") || lower.includes(".webm") || lower.includes("video/");
}

/**
 * Auto-playing video that respects on-screen visibility.
 *
 * Why this exists: a long menu page can easily have 10+ items with video
 * thumbnails. Autoplaying all of them simultaneously eats mobile data
 * (a few MB each), drains battery, and hammers the decoder. We use an
 * IntersectionObserver so each video only plays while its card is on
 * screen, and pauses the moment it scrolls away.
 *
 * preload="metadata" guarantees the first frame is loaded even if
 * autoplay is blocked (Safari Low Power Mode, some Android browsers) —
 * so the thumbnail never looks blank.
 */
function VideoThumb({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      // SSR / very old browser — just let the native autoplay try.
      node.play().catch(() => {});
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          node.play().catch(() => {});
        } else {
          node.pause();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <video
        ref={ref}
        src={src}
        className="h-full w-full object-cover"
        loop
        muted
        playsInline
        preload="metadata"
        aria-label={alt}
      />
      {/* Tiny corner badge so users know the thumbnail is interactive media */}
      <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/55 px-1 py-0.5 text-[8px] font-bold text-white tracking-wider">
        ▶ VIDEO
      </span>
    </>
  );
}

export function MenuItemCard({
  item,
  totalInCart,
  onClick,
  categoryName,
}: {
  item: MenuItemData;
  totalInCart: number;
  onClick: () => void;
  /** Category name of the item's section. Optional — used to pick a
   *  category-appropriate Phosphor placeholder icon when the item has no
   *  imageUrl. Search-result contexts may omit it; keyword fallback still fires. */
  categoryName?: string;
}) {
  const hasQty = totalInCart > 0;
  // Resolve a placeholder icon lazily so items with a real imageUrl never
  // pay the lookup cost.
  const placeholderIcon = !item.imageUrl ? iconForItem(item.name, categoryName) : null;

  return (
    <button
      onClick={item.available ? onClick : undefined}
      className={`group flex gap-3 rounded-2xl border bg-surface p-3 transition-all duration-300 text-left relative ${
        hasQty
          ? "border-primary/40 shadow-md shadow-primary/5"
          : "border-border/60 hover:border-primary/20 hover:shadow-sm"
      } ${!item.available ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      {/* Quantity badge */}
      {hasQty && (
        <div className="absolute -top-2 -right-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-xs font-bold shadow-md">
          {totalInCart}
        </div>
      )}

      {/* Image, video, or Phosphor placeholder icon */}
      {item.imageUrl ? (
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 to-slate-200">
          {isVideo(item.imageUrl) ? (
            <VideoThumb src={item.imageUrl} alt={item.name} />
          ) : (
            <Image
              src={item.imageUrl}
              alt={item.name}
              fill
              className="object-cover"
              sizes="96px"
            />
          )}
          {item.badge && (
            <span className="absolute top-1 left-1 rounded-md bg-primary/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {item.badge}
            </span>
          )}
        </div>
      ) : placeholderIcon ? (
        <div className={`relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl ${placeholderIcon.bgClass}`}>
          <placeholderIcon.Icon
            weight="duotone"
            className={`h-12 w-12 ${placeholderIcon.iconClass}`}
          />
          {item.badge && (
            <span className="absolute top-1 left-1 rounded-md bg-primary/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {item.badge}
            </span>
          )}
        </div>
      ) : null}

      {/* Info */}
      <div className="flex flex-1 flex-col justify-between min-w-0">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-bold text-text leading-snug truncate">
              {!item.imageUrl && item.badge && <span className="mr-1.5 inline-block rounded-md bg-primary/90 px-1.5 py-0.5 text-[10px] font-semibold text-white align-middle">{item.badge}</span>}
              {item.name}
            </h4>
            {item.rating && (
              <div className="flex items-center gap-0.5 shrink-0">
                <svg className="h-3 w-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-[11px] font-medium text-text-secondary">
                  {item.rating}
                </span>
              </div>
            )}
          </div>
          <p className="mt-0.5 text-xs text-text-muted line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        </div>

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-text tracking-tight">
              {item.pricingMode === "PACKAGED" && Array.isArray(item.quantityTiers) && item.quantityTiers.length > 0 ? (
                <>Desde ${((item.quantityTiers[0] as { price?: number }).price ?? item.price).toLocaleString("es-AR")}</>
              ) : item.pricingMode === "BY_WEIGHT" && Array.isArray(item.quantityTiers) && item.quantityTiers.length > 0 ? (
                <>${((item.quantityTiers[0] as { pricePerUnit?: number }).pricePerUnit ?? item.price).toLocaleString("es-AR")}/{item.weightUnit ?? "kg"}</>
              ) : (
                <>${item.price.toLocaleString("es-AR")}</>
              )}
            </span>
            {item.optionGroups && item.optionGroups.length > 0 && item.pricingMode === "FIXED" && (
              <span className="text-[9px] text-primary font-medium bg-primary/10 rounded px-1 py-0.5">Personalizable</span>
            )}
            {item.pricingMode === "PACKAGED" && (
              <span className="text-[9px] text-emerald-700 font-medium bg-emerald-100 rounded px-1 py-0.5">Elegí tamaño</span>
            )}
            {item.pricingMode === "BY_WEIGHT" && (
              <span className="text-[9px] text-emerald-700 font-medium bg-emerald-100 rounded px-1 py-0.5">Por peso</span>
            )}
          </div>

          {item.available ? (
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-primary/30 text-primary group-hover:bg-primary group-hover:text-white transition-all">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
          ) : (
            <span className="text-xs font-medium text-text-muted">No disponible</span>
          )}
        </div>
      </div>
    </button>
  );
}
