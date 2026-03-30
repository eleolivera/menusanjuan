"use client";

import Image from "next/image";
import type { MenuItemData } from "@/data/menus";

function isVideo(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes(".mp4") || lower.includes(".mov") || lower.includes(".webm") || lower.includes("video/");
}

export function MenuItemCard({
  item,
  quantity,
  onAdd,
  onRemove,
}: {
  item: MenuItemData;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const isSelected = quantity > 0;

  return (
    <div
      className={`group flex gap-3 rounded-2xl border bg-surface p-3 transition-all duration-300 ${
        isSelected
          ? "border-primary/40 shadow-md shadow-primary/5"
          : "border-border/60 hover:border-primary/20 hover:shadow-sm"
      } ${!item.available ? "opacity-50" : ""}`}
    >
      {/* Image or Video */}
      {item.imageUrl && (
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 to-slate-200">
          {isVideo(item.imageUrl) ? (
            <video
              src={item.imageUrl}
              className="h-full w-full object-cover"
              autoPlay
              loop
              muted
              playsInline
            />
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
      )}

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
          <span className="text-sm font-bold text-text tracking-tight">
            ${item.price.toLocaleString("es-AR")}
          </span>

          {item.available ? (
            <div className="flex items-center gap-1.5">
              {isSelected && (
                <button
                  onClick={onRemove}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-secondary hover:border-danger hover:text-danger transition-colors"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
                  </svg>
                </button>
              )}
              {isSelected && (
                <span className="min-w-[1.25rem] text-center text-sm font-bold text-primary">
                  {quantity}
                </span>
              )}
              <button
                onClick={onAdd}
                className={`flex h-7 items-center justify-center rounded-lg transition-all ${
                  isSelected
                    ? "w-7 bg-primary text-white"
                    : "w-7 border border-primary/30 text-primary hover:bg-primary hover:text-white"
                }`}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            </div>
          ) : (
            <span className="text-xs font-medium text-text-muted">No disponible</span>
          )}
        </div>
      </div>
    </div>
  );
}
