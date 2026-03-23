import { redirect } from "next/navigation";
import { getRestauranteSession } from "@/lib/restaurante-auth";

export default async function RestauranteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Login page doesn't need auth check
  // We handle auth in page components instead to avoid redirect loops
  return (
    <div className="min-h-screen bg-slate-950">
      {children}
    </div>
  );
}
