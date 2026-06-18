import { prisma } from "./prisma";
import type { Restaurant } from "@/data/restaurants";
import type { DeliveryConfig } from "./delivery";
import { parseDeliveryZones } from "./delivery";
import { isServiceOpenNow, getNextServiceOpenTime } from "./hours";

export type ServiceAvailability = {
  enabled: boolean;       // The owner's intent (toggle)
  openNow: boolean;       // Whether the schedule says open right now
  available: boolean;     // enabled && openNow && !manualClosed (use this for "can the customer pick this method?")
  nextOpenLabel: string | null;
  manualClosed: boolean;  // True if owner manually closed early (closedUntil > now)
  closedUntilLabel: string | null; // Human label of when the manual close lifts
};

export type RestaurantWithDealerId = Restaurant & {
  dealerId: string | null;
  isVerified: boolean;
  hasPendingOwner: boolean;
  ownerUserId: string | null;
  deliveryConfig: DeliveryConfig;
  mercadoPagoAlias: string | null;
  mercadoPagoCvu: string | null;
  bankInfo: string | null;
  pickupService: ServiceAvailability;
  deliveryService: ServiceAvailability;
};

export async function getRestaurantBySlug(slug: string): Promise<RestaurantWithDealerId | null> {
  const dealer = await prisma.dealer.findUnique({
    where: { slug },
    include: {
      account: { select: { userId: true } },
      categories: { select: { _count: { select: { items: true } } } },
    },
  });

  if (!dealer) return null;

  const itemCount = dealer.categories.reduce((s, c) => s + c._count.items, 0);

  // Fall back to legacy openHours if a method's specific schedule isn't set
  const pickupHoursRaw = dealer.pickupHours || dealer.openHours;
  const deliveryHoursRaw = dealer.deliveryHours || dealer.openHours;
  const pickupOpenNow = isServiceOpenNow(pickupHoursRaw);
  const deliveryOpenNow = isServiceOpenNow(deliveryHoursRaw);
  const pickupNextOpen = getNextServiceOpenTime(pickupHoursRaw);
  const deliveryNextOpen = getNextServiceOpenTime(deliveryHoursRaw);

  // Owner-triggered manual early-close. closedUntil is stored as a timestamp
  // (typically next morning 5am AR). If now < closedUntil → resta is closed
  // regardless of what the schedule says. Survives midnight rollover by design.
  const now = new Date();
  const manualClosed = !!(dealer.closedUntil && dealer.closedUntil.getTime() > now.getTime());
  const closedUntilLabel = dealer.closedUntil
    ? dealer.closedUntil.toLocaleString("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  // Owner-triggered force-open override (mirror of closedUntil). When set and
  // in the future, the resta is treated as open regardless of the schedule.
  // Used for testing or special events ("la abrimos hoy a la tarde aunque
  // normalmente sólo abrimos a la noche").
  const manualOpen = !!(dealer.openUntil && dealer.openUntil.getTime() > now.getTime());

  // Effective open-now: schedule says open OR owner force-opened. Manual close
  // still wins (you can manually close during a force-open window).
  const effectivePickupOpen  = pickupOpenNow  || manualOpen;
  const effectiveDeliveryOpen = deliveryOpenNow || manualOpen;

  const pickupService: ServiceAvailability = {
    enabled: dealer.pickupEnabled,
    openNow: effectivePickupOpen,
    available: dealer.pickupEnabled && effectivePickupOpen && !manualClosed,
    nextOpenLabel: pickupNextOpen,
    manualClosed,
    closedUntilLabel,
  };
  const deliveryService: ServiceAvailability = {
    enabled: dealer.deliveryEnabled,
    openNow: effectiveDeliveryOpen,
    available: dealer.deliveryEnabled && effectiveDeliveryOpen && !manualClosed,
    nextOpenLabel: deliveryNextOpen,
    manualClosed,
    closedUntilLabel,
  };

  // Restaurant is "open" if either service is available
  const isOpen = pickupService.available || deliveryService.available;

  return {
    id: dealer.id,
    dealerId: dealer.id,
    name: dealer.name,
    slug: dealer.slug,
    description: dealer.description || "",
    phone: dealer.phone,
    address: dealer.address || "",
    cuisineType: dealer.cuisineType,
    logoUrl: dealer.logoUrl,
    coverUrl: dealer.coverUrl,
    rating: dealer.rating ?? 0,
    itemCount,
    priceRange: "$$",
    isOpen,
    deliveryTimeMin: dealer.deliveryTimeMin ?? null,
    isVerified: dealer.isVerified,
    hasPendingOwner: !!dealer.pendingOwnerEmail,
    ownerUserId: dealer.account.userId,
    deliveryConfig: {
      deliveryEnabled: dealer.deliveryEnabled,
      deliveryPricingEnabled: dealer.deliveryPricingEnabled,
      deliveryZones: parseDeliveryZones(dealer.deliveryZones),
      deliveryCloseRadius: dealer.deliveryCloseRadius,
      deliveryClosePrice: dealer.deliveryClosePrice,
      deliveryFarRadius: dealer.deliveryFarRadius,
      deliveryFarPrice: dealer.deliveryFarPrice,
      deliveryFee: dealer.deliveryFee,
      latitude: dealer.latitude,
      longitude: dealer.longitude,
    },
    mercadoPagoAlias: dealer.mercadoPagoAlias,
    mercadoPagoCvu: dealer.mercadoPagoCvu,
    bankInfo: dealer.bankInfo,
    pickupService,
    deliveryService,
  };
}
