// Resta owner's driver management. Uses the shared DriverAdmin component
// pointed at /api/restaurante/drivers (owner-authed, scoped to this dealer).
// The route is only reachable via the sidebar nav when Dealer.deliveryMode
// is OWN or HYBRID; direct hit is fine even if mode is MANUAL (the CRUD
// works either way, but there's no dispatch consumer yet — Phase 3).

import { DriverAdmin } from "@/components/drivers/DriverAdmin";

export const dynamic = "force-dynamic";

export default function RestauranteDriversPage() {
  return (
    <div className="h-full overflow-y-auto bg-slate-950">
      <DriverAdmin apiBase="/api/restaurante/drivers" contextLabel="Mis repartidores" />
    </div>
  );
}
