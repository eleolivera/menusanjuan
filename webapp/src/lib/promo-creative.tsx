// Server-side 1080×1080 promo card for Instagram, rendered with satori via
// `next/og` ImageResponse. Shared by the owner-facing API route and the local
// sample script so both produce byte-identical output.
//
// Satori constraints to keep in mind when editing:
//   • every element with >1 child needs `display: "flex"`
//   • images need explicit width/height
//   • only the fonts passed in are available — we ship Inter 400/600/700/800
//   • no CSS grid, no `gap` on inline, no pseudo-elements

import { readFileSync } from "fs";
import path from "path";
import type { PromoDealer, PromoItem } from "./promo-recipe";
import { formatItemPrice } from "./promo-recipe";

export const PROMO_SIZE = { width: 1080, height: 1080 } as const;

export type PromoFont = { name: string; data: ArrayBuffer; weight: 400 | 600 | 700 | 800; style: "normal" };

let fontCache: PromoFont[] | null = null;

/** Load Inter from public/fonts (works locally + on Vercel's Node runtime). */
export function loadPromoFonts(): PromoFont[] {
  if (fontCache) return fontCache;
  const dir = path.join(process.cwd(), "public", "fonts");
  const weights: Array<400 | 600 | 700 | 800> = [400, 600, 700, 800];
  fontCache = weights.map((w) => {
    const buf = readFileSync(path.join(dir, `Inter-${w}.woff`));
    return { name: "Inter", data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), weight: w, style: "normal" as const };
  });
  return fontCache;
}

const BRAND_ORANGE = "#f97316";
const BRAND_AMBER = "#f59e0b";

export function PromoCard({ dealer, items }: { dealer: PromoDealer & { logoUrl?: string | null }; items: PromoItem[] }) {
  const hero = items[0];
  const isSingle = items.length === 1;
  const modes = [dealer.deliveryEnabled ? "Delivery" : null, dealer.pickupEnabled ? "Retiro" : null].filter(Boolean).join(" · ");

  return (
    <div
      style={{
        width: PROMO_SIZE.width,
        height: PROMO_SIZE.height,
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(160deg, #1a0f05 0%, #0b0704 55%, #120a03 100%)",
        color: "#fff",
        fontFamily: "Inter",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Warm glow, top-right */}
      <div
        style={{
          position: "absolute",
          top: -220,
          right: -220,
          width: 640,
          height: 640,
          borderRadius: 9999,
          background: `radial-gradient(circle, ${BRAND_ORANGE}66 0%, ${BRAND_AMBER}22 45%, transparent 70%)`,
          display: "flex",
        }}
      />

      {/* Header: logo + name */}
      <div style={{ display: "flex", alignItems: "center", padding: "56px 64px 0 64px" }}>
        {dealer.logoUrl ? (
          <img
            src={dealer.logoUrl}
            width={96}
            height={96}
            style={{ borderRadius: 24, objectFit: "cover", border: "3px solid rgba(255,255,255,0.15)" }}
          />
        ) : (
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 24,
              background: `linear-gradient(135deg, ${BRAND_ORANGE}, ${BRAND_AMBER})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 48,
              fontWeight: 800,
            }}
          >
            {dealer.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", marginLeft: 24 }}>
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>{dealer.name}</div>
          {modes && <div style={{ fontSize: 22, fontWeight: 600, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>{`${modes} · San Juan`}</div>}
        </div>
      </div>

      {/* Body */}
      {isSingle ? (
        <div style={{ display: "flex", flex: 1, alignItems: "center", padding: "40px 64px 0 64px" }}>
          <div style={{ display: "flex", position: "relative" }}>
            {hero.imageUrl ? (
              <img
                src={hero.imageUrl}
                width={560}
                height={560}
                style={{ borderRadius: 40, objectFit: "cover", boxShadow: "0 40px 80px rgba(0,0,0,0.6)" }}
              />
            ) : (
              <div style={{ width: 560, height: 560, borderRadius: 40, background: "#2a1a0c", display: "flex" }} />
            )}
            {hero.badge && (
              <div
                style={{
                  position: "absolute",
                  top: 24,
                  left: 24,
                  background: BRAND_ORANGE,
                  color: "#fff",
                  fontSize: 26,
                  fontWeight: 800,
                  padding: "10px 20px",
                  borderRadius: 999,
                  letterSpacing: 2,
                  display: "flex",
                }}
              >
                {hero.badge.toUpperCase()}
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginLeft: 48, flex: 1 }}>
            <div style={{ fontSize: 60, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>{hero.name}</div>
            <div
              style={{
                marginTop: 28,
                fontSize: 76,
                fontWeight: 800,
                color: BRAND_AMBER,
                letterSpacing: -2,
                lineHeight: 1,
              }}
            >
              {formatItemPrice(hero)}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", padding: "40px 64px 0 64px" }}>
          {items.slice(0, 3).map((it, i) => (
            <div
              key={it.id}
              style={{
                display: "flex",
                flexDirection: "column",
                width: items.length === 2 ? 440 : 296,
                marginLeft: i === 0 ? 0 : 24,
                background: "rgba(255,255,255,0.06)",
                borderRadius: 32,
                padding: 16,
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {it.imageUrl ? (
                <img
                  src={it.imageUrl}
                  width={items.length === 2 ? 408 : 264}
                  height={items.length === 2 ? 320 : 264}
                  style={{ borderRadius: 22, objectFit: "cover" }}
                />
              ) : (
                <div style={{ width: items.length === 2 ? 408 : 264, height: items.length === 2 ? 320 : 264, borderRadius: 22, background: "#2a1a0c", display: "flex" }} />
              )}
              <div style={{ display: "flex", flexDirection: "column", marginTop: 18 }}>
                <div style={{ fontSize: items.length === 2 ? 34 : 28, fontWeight: 700, lineHeight: 1.1 }}>{it.name}</div>
                <div style={{ fontSize: items.length === 2 ? 40 : 34, fontWeight: 800, color: BRAND_AMBER, marginTop: 8 }}>{formatItemPrice(it)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer CTA */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 64px 56px 64px", marginTop: 40 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: `linear-gradient(90deg, ${BRAND_ORANGE}, ${BRAND_AMBER})`,
            borderRadius: 999,
            padding: "20px 36px",
            fontSize: 30,
            fontWeight: 800,
            whiteSpace: "nowrap",
          }}
        >
          {`Pedí acá 👉 menusanjuan.com/${dealer.slug}`}
        </div>
        {/* Brand tile only — the URL already says MenuSanJuan; text label was
            eating width and forcing the CTA pill to wrap on longer slugs. */}
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: `linear-gradient(135deg, ${BRAND_ORANGE}, ${BRAND_AMBER})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 30,
            fontWeight: 800,
            color: "#fff",
            marginLeft: 24,
          }}
        >
          M
        </div>
      </div>
    </div>
  );
}
