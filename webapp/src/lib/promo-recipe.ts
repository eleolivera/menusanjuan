// Promo "receta" builder — Layer 1 of the Instagram ads feature.
//
// Turns data we already hold on a Dealer (coordinates, hours, delivery zones,
// menu items) into the three things an owner needs to boost a post in Meta
// Ads Manager without guessing:
//   1. a Spanish caption for the IG post
//   2. a step-by-step recipe with the exact Ads Manager settings (radius
//      pinned to their coordinates, dayparting matched to their hours,
//      lifetime budget in ARS, tracked link)
//   3. the machine-readable `adset_schedule` + `custom_locations` shapes so
//      Layer 2 (Marketing API autopilot) can reuse the same math.
//
// Pure functions — no DB, safe on client + server.

export type PromoDealer = {
  slug: string;
  name: string;
  city?: string | null;
  latitude: number | null;
  longitude: number | null;
  pickupHours?: string | null;
  deliveryHours?: string | null;
  openHours?: string | null;
  deliveryEnabled?: boolean;
  pickupEnabled?: boolean;
  deliveryZones?: string | null; // JSON [{radius, price}]
  cuisineType?: string | null;
};

export type PromoItem = {
  id: string;
  name: string;
  price: number;
  imageUrl?: string | null;
  badge?: string | null;
  pricingMode?: "FIXED" | "PACKAGED" | "BY_WEIGHT" | string | null;
  weightUnit?: string | null;
};

export type AdsetScheduleEntry = { days: number[]; start_minute: number; end_minute: number };

export type Receta = {
  objetivo: string;
  link: string;
  pin: { lat: number; lng: number } | null;
  radioKm: number;
  horario: { resumen: string; adsetSchedule: AdsetScheduleEntry[] };
  presupuesto: { minimoDiarioArs: number; sugeridoDiarioArs: number; dias: number; totalArs: number };
  cta: string;
  pasos: string[];
  adsManagerUrl: string;
  // Layer 2 payload preview — what we'd send to the Marketing API.
  targetingPreview: {
    geo_locations: { custom_locations: Array<{ latitude: number; longitude: number; radius: number; distance_unit: "kilometer" }> };
    age_min: number;
    age_max: number;
    targeting_automation: { advantage_audience: 0 };
  } | null;
};

// Meta's published minimum for an ARS ad account (Aug 2026): ARS 1.504,46/día.
export const META_MIN_DAILY_ARS = 1505;
export const ADS_MANAGER_URL = "https://www.facebook.com/adsmanager/creation";

const DAY_INDEX: Record<string, number> = { dom: 0, lun: 1, mar: 2, mie: 3, jue: 4, vie: 5, sab: 6 };
const DAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

type Window = { open: string; close: string };

function hhmmToMin(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Parse either schema (legacy {open,close,closed} or modern arrays) into day → windows. */
function parseWeek(raw: string | null | undefined): Record<string, Window[]> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, Window[]> = {};
    for (const k of Object.keys(parsed)) {
      const v = parsed[k] as { open?: string; close?: string; closed?: boolean } | Window[];
      if (Array.isArray(v)) out[k] = v.filter((w) => w?.open && w?.close);
      else if (v && typeof v === "object" && "open" in v && "close" in v) out[k] = v.closed ? [] : [{ open: v.open!, close: v.close! }];
    }
    return out;
  } catch {
    return null;
  }
}

export function formatArs(n: number): string {
  return `$ ${Math.round(n).toLocaleString("es-AR")}`;
}

export function formatItemPrice(item: PromoItem): string {
  if (item.pricingMode === "PACKAGED") return `desde ${formatArs(item.price)}`;
  if (item.pricingMode === "BY_WEIGHT") return `${formatArs(item.price)}/${item.weightUnit || "kg"}`;
  return formatArs(item.price);
}

/**
 * Convert resta hours → Meta `adset_schedule` entries + a human summary.
 * Past-midnight windows (21:00–02:00) split into [21:00–24:00 on day D] and
 * [00:00–02:00 on day D+1], which is how Meta's hourly grid models them.
 */
export function hoursToAdsetSchedule(raw: string | null | undefined): { resumen: string; adsetSchedule: AdsetScheduleEntry[] } {
  const week = parseWeek(raw);
  if (!week) return { resumen: "Todo el día, todos los días", adsetSchedule: [] };

  // Collect (day, start, end) triples in minutes.
  const triples: Array<{ day: number; start: number; end: number }> = [];
  for (const [key, windows] of Object.entries(week)) {
    const day = DAY_INDEX[key];
    if (day === undefined) continue;
    for (const w of windows) {
      const start = hhmmToMin(w.open);
      let end = hhmmToMin(w.close);
      if (end <= start) {
        triples.push({ day, start, end: 1440 });
        triples.push({ day: (day + 1) % 7, start: 0, end });
      } else {
        triples.push({ day, start, end });
      }
    }
  }
  if (triples.length === 0) return { resumen: "Sin horario cargado", adsetSchedule: [] };

  // Group identical windows across days → Meta entries.
  const byWindow = new Map<string, Set<number>>();
  for (const t of triples) {
    const k = `${t.start}-${t.end}`;
    if (!byWindow.has(k)) byWindow.set(k, new Set());
    byWindow.get(k)!.add(t.day);
  }
  const adsetSchedule: AdsetScheduleEntry[] = Array.from(byWindow.entries()).map(([k, days]) => {
    const [start, end] = k.split("-").map(Number);
    return { days: Array.from(days).sort((a, b) => a - b), start_minute: start, end_minute: end };
  });

  // Human summary from the ORIGINAL windows (not the split ones): group days
  // that share the same open/close string.
  const byLabel = new Map<string, number[]>();
  for (const [key, windows] of Object.entries(week)) {
    const day = DAY_INDEX[key];
    if (day === undefined || windows.length === 0) continue;
    const label = windows.map((w) => `${w.open}–${w.close}`).join(" y ");
    if (!byLabel.has(label)) byLabel.set(label, []);
    byLabel.get(label)!.push(day);
  }
  const parts: string[] = [];
  for (const [label, days] of byLabel) {
    parts.push(`${compressDays(days)} · ${label}`);
  }
  return { resumen: parts.join(" | "), adsetSchedule };
}

/** [4,5,6,0] → "Jue a Dom"; [1,3,5] → "Lun, Mié, Vie". Week order Lun→Dom. */
function compressDays(days: number[]): string {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const sorted = order.filter((d) => days.includes(d));
  if (sorted.length === 7) return "Todos los días";
  if (sorted.length === 0) return "";
  // Check contiguity in Lun→Dom order
  const idx = sorted.map((d) => order.indexOf(d));
  const contiguous = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  if (contiguous && sorted.length >= 3) return `${DAY_SHORT[sorted[0]]} a ${DAY_SHORT[sorted[sorted.length - 1]]}`;
  return sorted.map((d) => DAY_SHORT[d]).join(", ");
}

/** Radius suggestion: widest delivery zone if defined, else 4 km (covers a San Juan departamento). */
export function suggestRadiusKm(dealer: PromoDealer): number {
  if (dealer.deliveryZones) {
    try {
      const zones = JSON.parse(dealer.deliveryZones) as Array<{ radius?: number; radiusKm?: number }>;
      const max = Math.max(...zones.map((z) => Number(z.radius ?? z.radiusKm ?? 0)));
      if (Number.isFinite(max) && max >= 1) return Math.min(Math.round(max), 80);
    } catch { /* fall through */ }
  }
  return 4;
}

// Canonical host is www — apex 307-redirects to it. Give Meta the final URL
// so its link checker doesn't flag a redirect and the landing skips a hop.
export function promoLink(dealer: PromoDealer, campaign = "promo", itemId?: string): string {
  // ?item=<id> makes the store page open that item's picker on landing —
  // two fewer taps between the ad and "Agregar al pedido" for single-item promos.
  const item = itemId ? `item=${encodeURIComponent(itemId)}&` : "";
  return `https://www.menusanjuan.com/${dealer.slug}?${item}utm_source=ig&utm_medium=paid&utm_campaign=${encodeURIComponent(campaign)}`;
}

const ITEM_EMOJI: Array<{ re: RegExp; emoji: string }> = [
  { re: /lomo/i, emoji: "🥖" },
  { re: /burger|hamburg/i, emoji: "🍔" },
  { re: /pizza/i, emoji: "🍕" },
  { re: /empanad/i, emoji: "🥟" },
  { re: /papas|fritas/i, emoji: "🍟" },
  { re: /miel/i, emoji: "🍯" },
  { re: /nuez|almendra|man[ií]|frutos secos/i, emoji: "🥜" },
  { re: /pachata|sandwich|s[aá]ndwich/i, emoji: "🥪" },
  { re: /combo|promo/i, emoji: "🔥" },
];
function emojiFor(name: string): string {
  return ITEM_EMOJI.find((e) => e.re.test(name))?.emoji ?? "🍽️";
}

/** Spanish IG caption. Voseo, short lines, link last so it's tappable in the bio/CTA. */
export function buildCaption(dealer: PromoDealer, items: PromoItem[], opts?: { campaign?: string; itemId?: string }): string {
  const link = promoLink(dealer, opts?.campaign, opts?.itemId);
  const where = dealer.city && dealer.city !== "San Juan" ? dealer.city : "San Juan";
  const modes = [dealer.deliveryEnabled ? "Delivery" : null, dealer.pickupEnabled ? "Retiro" : null].filter(Boolean).join(" y ");
  const { resumen } = hoursToAdsetSchedule(dealer.pickupHours || dealer.deliveryHours || dealer.openHours);

  const lines: string[] = [];
  if (items.length === 1) {
    const it = items[0];
    lines.push(`${emojiFor(it.name)} ${it.name} — ${formatItemPrice(it)}`);
  } else {
    lines.push(`${emojiFor(items[0].name)} ${dealer.name}`);
    lines.push("");
    for (const it of items) lines.push(`• ${it.name} — ${formatItemPrice(it)}`);
  }
  lines.push("");
  if (modes) lines.push(`📍 ${modes} en ${where}`);
  if (resumen && !/sin horario/i.test(resumen)) lines.push(`🕗 ${resumen}`);
  lines.push("");
  lines.push(`Pedí acá 👉 ${link}`);
  lines.push("");
  // Strip accents before dropping non-alphanumerics so "Comida Rápida" →
  // #ComidaRapida, not #ComidaRpida.
  const tag = (dealer.cuisineType || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]/g, "");
  lines.push(["#SanJuan", "#Delivery", tag ? `#${tag}` : null, "#MenuSanJuan"].filter(Boolean).join(" "));
  return lines.join("\n");
}

/** The step-by-step Ads Manager recipe + Layer-2 targeting preview. */
export function buildReceta(
  dealer: PromoDealer,
  items: PromoItem[],
  opts?: { campaign?: string; dias?: number; diarioArs?: number; itemId?: string },
): Receta {
  const dias = opts?.dias ?? 5;
  const sugeridoDiario = Math.max(META_MIN_DAILY_ARS, opts?.diarioArs ?? 2000);
  const totalArs = sugeridoDiario * dias;
  const radioKm = suggestRadiusKm(dealer);
  const link = promoLink(dealer, opts?.campaign, opts?.itemId);
  const pin = dealer.latitude != null && dealer.longitude != null ? { lat: dealer.latitude, lng: dealer.longitude } : null;
  const horario = hoursToAdsetSchedule(dealer.pickupHours || dealer.deliveryHours || dealer.openHours);
  const hasSchedule = horario.adsetSchedule.length > 0;

  const pasos = [
    `Objetivo: **Tráfico** ("Más visitas al sitio web"). No uses "Interacción" — queremos clics al menú, no likes.`,
    pin
      ? `Ubicación: elegí **"Personas seleccionadas"** → tocá **"Soltar pin"** y usá estas coordenadas: **${pin.lat.toFixed(6)}, ${pin.lng.toFixed(6)}** → radio **${radioKm} km**. (Si San Juan no aparece como ciudad, el pin lo resuelve.)`
      : `Ubicación: cargá primero la dirección de tu negocio en "Mi Restaurante" para que podamos darte el pin exacto. Mientras tanto, usá "Soltar pin" sobre tu local con radio ${radioKm} km.`,
    `Desactivá **"Expandir audiencia" / Advantage+ audience** — si queda activado, Meta muestra el aviso fuera de tu radio.`,
    `Edad: **18 a 55**. Género: todos. Sin intereses (dejalo amplio; el radio ya filtra).`,
    `Presupuesto: elegí **"Presupuesto total"** (no diario) = **${formatArs(totalArs)}** durante **${dias} días**. El total es obligatorio para poder programar horarios. Mínimo de Meta ≈ ${formatArs(META_MIN_DAILY_ARS)}/día.`,
    hasSchedule
      ? `Programación de anuncios: activá **"Programar anuncios"** y marcá solo **${horario.resumen}** (zona horaria del público). Así no gastás plata cuando estás cerrado.`
      : `Programación: cargá tus horarios en "Mi Restaurante" y te armamos la grilla. Por ahora dejalo todo el día.`,
    `Destino: pegá este link → **${link}**`,
    `Botón (CTA): **"Realizar pedido"** (o "Comprar ahora").`,
    `Subí la imagen que descargaste acá y pegá el texto del posteo. Publicar → Meta lo revisa en ~1 h.`,
  ];

  return {
    objetivo: "OUTCOME_TRAFFIC",
    link,
    pin,
    radioKm,
    horario,
    presupuesto: { minimoDiarioArs: META_MIN_DAILY_ARS, sugeridoDiarioArs: sugeridoDiario, dias, totalArs },
    cta: "ORDER_NOW",
    pasos,
    adsManagerUrl: ADS_MANAGER_URL,
    targetingPreview: pin
      ? {
          geo_locations: { custom_locations: [{ latitude: pin.lat, longitude: pin.lng, radius: radioKm, distance_unit: "kilometer" }] },
          age_min: 18,
          age_max: 55,
          targeting_automation: { advantage_audience: 0 },
        }
      : null,
  };
}
