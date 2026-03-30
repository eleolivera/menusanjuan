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

export type DeliveryZoneResult = {
  zone: "close" | "far" | null;
  fee: number | null;
  distanceKm: number;
};

export type DeliveryConfig = {
  deliveryEnabled: boolean;
  deliveryCloseRadius: number | null;
  deliveryClosePrice: number | null;
  deliveryFarRadius: number | null;
  deliveryFarPrice: number | null;
  deliveryFee: number | null; // legacy flat fallback
  latitude: number | null;
  longitude: number | null;
};

// Calculate delivery fee based on restaurant config and customer location
export function calculateDeliveryFee(
  config: DeliveryConfig,
  customerLat: number,
  customerLng: number
): DeliveryZoneResult | null {
  // Check if any pricing is configured at all
  const hasZones = config.deliveryCloseRadius != null && config.deliveryClosePrice != null;
  const hasFlatFee = config.deliveryFee != null && config.deliveryFee > 0;

  // No pricing configured — return null so UI shows "consultá con el restaurante"
  if (!hasZones && !hasFlatFee) {
    return null;
  }

  // No restaurant coordinates — can't calculate distance
  if (config.latitude == null || config.longitude == null) {
    // Has zones but no coordinates = can't calculate, show "consultá"
    if (hasZones) return null;
    // Has flat fee only = apply flat fee regardless
    if (hasFlatFee) {
      return { zone: "close", fee: config.deliveryFee!, distanceKm: 0 };
    }
    return null;
  }

  const distanceKm = haversineDistance(
    config.latitude, config.longitude,
    customerLat, customerLng
  );

  // Zone-based pricing
  if (hasZones) {
    if (distanceKm <= config.deliveryCloseRadius!) {
      return { zone: "close", fee: config.deliveryClosePrice!, distanceKm };
    }

    if (config.deliveryFarRadius != null && config.deliveryFarPrice != null) {
      if (distanceKm <= config.deliveryFarRadius) {
        return { zone: "far", fee: config.deliveryFarPrice, distanceKm };
      }
    }

    // Out of range
    return { zone: null, fee: null, distanceKm };
  }

  // Flat fee fallback
  return { zone: "close", fee: config.deliveryFee!, distanceKm };
}
