import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") || "";
  const { pathname } = request.nextUrl;

  // admin.menusanjuan.com → rewrite to /admin/*
  if (hostname.startsWith("admin.")) {
    // API routes and /admin paths pass through as-is
    if (pathname.startsWith("/admin") || pathname.startsWith("/api/")) return NextResponse.next();

    // Rewrite everything else to /admin/*
    const url = request.nextUrl.clone();
    url.pathname = `/admin${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.svg).*)"],
};
