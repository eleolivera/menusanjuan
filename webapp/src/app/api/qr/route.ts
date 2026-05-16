import { NextRequest } from "next/server";
import QRCode from "qrcode";

/**
 * GET /api/qr?data=<url>&size=<px>&margin=<modules>
 *
 * Returns a real PNG image of the QR. Used by the printable ticket page —
 * thermal printer drivers (ESC/POS) fetch this via HTTP and rasterize it
 * reliably; data:image/png URLs and inline <svg> tend to get dropped by
 * those drivers during the bitmap conversion step.
 *
 * Strongly cached: same data → same PNG forever.
 */
export async function GET(request: NextRequest) {
  const data = request.nextUrl.searchParams.get("data");
  if (!data) {
    return new Response("Missing data param", { status: 400 });
  }
  const size = Math.min(800, Math.max(64, Number(request.nextUrl.searchParams.get("size") || 320)));
  const margin = Math.min(8, Math.max(0, Number(request.nextUrl.searchParams.get("margin") || 1)));

  try {
    const png = await QRCode.toBuffer(data, {
      type: "png",
      errorCorrectionLevel: "H",
      margin,
      width: size,
      color: { dark: "#000000", light: "#FFFFFF" },
    });
    return new Response(png as unknown as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(png.length),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    return new Response(`QR generation failed: ${(err as Error).message}`, { status: 500 });
  }
}
