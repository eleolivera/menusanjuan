"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const CHROMELESS_PREFIXES = ["/admin", "/restaurante"];

export function ConditionalChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdminSubdomain = typeof window !== "undefined" && window.location.hostname.startsWith("admin.");
  const hideChrome = isAdminSubdomain || CHROMELESS_PREFIXES.some((p) => pathname.startsWith(p));

  if (hideChrome) {
    return <>{children}</>;
  }

  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
