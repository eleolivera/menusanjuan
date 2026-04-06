import { DashboardShell } from "@/components/restaurante/DashboardShell";

export default function RestauranteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen bg-slate-950 overflow-hidden">
      <DashboardShell>{children}</DashboardShell>
    </div>
  );
}
