// Driver PWA logout — clears the msj_driver_session cookie. Public so a
// driver whose cookie is somehow present-but-invalid can still reach it.

import { NextResponse } from "next/server";
import { clearDriverSessionCookie } from "@/lib/driver-auth";

export async function DELETE() {
  await clearDriverSessionCookie();
  return NextResponse.json({ ok: true });
}
