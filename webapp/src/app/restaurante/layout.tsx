import { DashboardShell } from "@/components/restaurante/DashboardShell";

export default function RestauranteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950">
      <DashboardShell>{children}</DashboardShell>
    </div>
  );
}
