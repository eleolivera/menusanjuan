// Elio's network-driver management. Uses the shared DriverAdmin component
// pointed at /api/admin/network/drivers (admin-authed, scoped to
// ownerDealerId=null). These are MenuSanJuan's own delivery employees.

import { DriverAdmin } from "@/components/drivers/DriverAdmin";

export const dynamic = "force-dynamic";

export default function AdminNetworkDriversPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <DriverAdmin apiBase="/api/admin/network/drivers" contextLabel="Red MenuSanJuan" />
    </div>
  );
}
