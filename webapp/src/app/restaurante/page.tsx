"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RestaurantePage() {
  const router = useRouter();
  useEffect(() => {
    fetch("/api/restaurante/profile")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        const needsOnboarding = !data.isActive && (!data.phone || !data.logoUrl);
        if (needsOnboarding) {
          router.replace("/restaurante/bienvenida");
        } else {
          router.replace("/restaurante/menu");
        }
      })
      .catch(() => {
        router.replace("/restaurante/menu");
      });
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center bg-slate-950">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
