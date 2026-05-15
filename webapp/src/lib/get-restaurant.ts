import { prisma } from "./prisma";
import type { Restaurant } from "@/data/restaurants";
import type { DeliveryConfig } from "./delivery";
import { parseDeliveryZones } from "./delivery";
import { isServiceOpenNow, getNextServiceOpenTime } from "./hours";

export type ServiceAvailability = {
  enabled: boolean;       // The owner's intent (toggle)
  openNow: boolean;       // Whether the schedule says open right now
  available: boolean;     // enabled && openNow (use this for "can the customer pick this method?")
  nextOpenLabel: string | null;
};

export type RestaurantWithDealerId = Restaurant & {
  dealerId: string | null;
  isVerified: boolean;
  hasPendingOwner: boolean;
  ownerUserId: string | null;
  deliveryConfig: DeliveryConfig;
  mercadoPagoAlias: string | null;
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

  const pickupService: ServiceAvailability = {
    enabled: dealer.pickupEnabled,
    openNow: pickupOpenNow,
    available: dealer.pickupEnabled && pickupOpenNow,
    nextOpenLabel: pickupNextOpen,
  };
  const deliveryService: ServiceAvailability = {
    enabled: dealer.deliveryEnabled,
    openNow: deliveryOpenNow,
    available: dealer.deliveryEnabled && deliveryOpenNow,
    nextOpenLabel: deliveryNextOpen,
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
    pickupService,
    deliveryService,
  };
}
