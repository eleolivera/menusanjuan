"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RestaurantePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/restaurante/profile");
  }, [router]);

  return null;
}
