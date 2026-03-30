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
): DeliveryZoneResult {
  // No restaurant coordinates — use flat fee fallback
  if (config.latitude == null || config.longitude == null) {
    return {
      zone: "close",
      fee: config.deliveryFee ?? 0,
      distanceKm: 0,
    };
  }

  const distanceKm = haversineDistance(
    config.latitude, config.longitude,
    customerLat, customerLng
  );

  // Zone-based pricing
  if (config.deliveryCloseRadius != null && config.deliveryClosePrice != null) {
    if (distanceKm <= config.deliveryCloseRadius) {
      return { zone: "close", fee: config.deliveryClosePrice, distanceKm };
    }

    if (config.deliveryFarRadius != null && config.deliveryFarPrice != null) {
      if (distanceKm <= config.deliveryFarRadius) {
        return { zone: "far", fee: config.deliveryFarPrice, distanceKm };
      }
    }

    // Out of range
    return { zone: null, fee: null, distanceKm };
  }

  // No zones configured — use flat fee fallback
  if (config.deliveryFee != null) {
    return { zone: "close", fee: config.deliveryFee, distanceKm };
  }

  // No delivery config at all — free delivery
  return { zone: "close", fee: 0, distanceKm };
}
