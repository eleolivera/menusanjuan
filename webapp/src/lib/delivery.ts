/**
 * Delivery zone calculation utilities
 */

// Haversine formula — returns distance in km between two lat/lng points
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export type DeliveryZone = { radius: number; price: number };

export type DeliveryZoneResult = {
  zone: "close" | "far" | null; // legacy label kept for OrderModal banner; new code can use zoneIndex
  zoneIndex: number | null;     // 0-based index into the zones array (null when out of range / flat fee)
  fee: number | null;
  distanceKm: number;
};

export type DeliveryConfig = {
  deliveryEnabled: boolean;
  /** Owner toggle: when false, no auto-pricing — the resta tells the customer the cost manually via WhatsApp. The public site shows "Costo a confirmar". */
  deliveryPricingEnabled: boolean;
  /** New: array of zones, up to 5, sorted asc by radius. Preferred over close/far. */
  deliveryZones?: DeliveryZone[] | null;
  deliveryCloseRadius: number | null; // legacy
  deliveryClosePrice: number | null;  // legacy
  deliveryFarRadius: number | null;   // legacy
  deliveryFarPrice: number | null;    // legacy
  deliveryFee: number | null;         // legacy flat fallback
  latitude: number | null;
  longitude: number | null;
};

/** Parse raw JSON into a sorted, validated zones array. Returns empty array if invalid. */
export function parseDeliveryZones(raw: string | null | undefined): DeliveryZone[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const zones: DeliveryZone[] = parsed
      .filter((z) => z && typeof z.radius === "number" && typeof z.price === "number" && z.radius > 0)
      .map((z) => ({ radius: Number(z.radius), price: Number(z.price) }))
      .sort((a, b) => a.radius - b.radius);
    return zones.slice(0, 5);
  } catch {
    return [];
  }
}

// Calculate delivery fee based on restaurant config and customer location.
// New code path: use config.deliveryZones (array). Falls back to legacy close/far.
export function calculateDeliveryFee(
  config: DeliveryConfig,
  customerLat: number,
  customerLng: number
): DeliveryZoneResult | null {
  if (!config.deliveryEnabled) {
    return null;
  }
  // Owner explicitly opted out of auto-pricing — short-circuit and let the UI
  // fall through to "Costo a confirmar" regardless of any saved zones/flat fee.
  if (!config.deliveryPricingEnabled) {
    return null;
  }

  const zones = config.deliveryZones && config.deliveryZones.length > 0
    ? config.deliveryZones
    : legacyZonesFromConfig(config);

  const hasZones = zones.length > 0;
  const hasFlatFee = config.deliveryFee != null && config.deliveryFee > 0;

  if (!hasZones && !hasFlatFee) {
    return null;
  }

  // No restaurant coordinates → can't measure distance
  if (config.latitude == null || config.longitude == null) {
    if (hasZones) return null;
    if (hasFlatFee) {
      return { zone: "close", zoneIndex: null, fee: config.deliveryFee!, distanceKm: 0 };
    }
    return null;
  }

  const distanceKm = haversineDistance(config.latitude, config.longitude, customerLat, customerLng);

  if (hasZones) {
    // Zones are sorted asc by radius; first one that contains the point wins
    for (let i = 0; i < zones.length; i++) {
      const z = zones[i];
      if (distanceKm <= z.radius) {
        const legacyLabel: "close" | "far" = i === 0 ? "close" : "far";
        return { zone: legacyLabel, zoneIndex: i, fee: z.price, distanceKm };
      }
    }
    // Out of range
    return { zone: null, zoneIndex: null, fee: null, distanceKm };
  }

  // Flat fee fallback — optionally capped by deliveryFarRadius (used as "max distance")
  if (config.deliveryFarRadius != null && distanceKm > config.deliveryFarRadius) {
    return { zone: null, zoneIndex: null, fee: null, distanceKm };
  }
  return { zone: "close", zoneIndex: null, fee: config.deliveryFee!, distanceKm };
}

/** Reconstruct a zones array from the legacy close/far fields (back-compat). */
function legacyZonesFromConfig(config: DeliveryConfig): DeliveryZone[] {
  const out: DeliveryZone[] = [];
  if (config.deliveryCloseRadius != null && config.deliveryClosePrice != null) {
    out.push({ radius: config.deliveryCloseRadius, price: config.deliveryClosePrice });
  }
  if (config.deliveryFarRadius != null && config.deliveryFarPrice != null) {
    out.push({ radius: config.deliveryFarRadius, price: config.deliveryFarPrice });
  }
  return out.sort((a, b) => a.radius - b.radius);
}
