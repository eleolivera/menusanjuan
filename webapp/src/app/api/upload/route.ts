import { NextRequest, NextResponse } from "next/server";
import { uploadToR2, resolveUrlToR2 } from "@/lib/r2";
import { getSession } from "@/lib/restaurante-auth";
import { getAdminSession } from "@/lib/admin-auth";

// Extract extension from a URL (handles query params, CDN URLs like Instagram/Facebook)
function getExtFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.(jpg|jpeg|png|webp|gif|svg|mp4|mov|webm)$/i);
    return match ? match[1].toLowerCase() : "jpg";
  } catch {
    return "jpg";
  }
}

// POST — upload image (file or URL)
export async function POST(request: NextRequest) {
  // Determine type early so we can allow specific anonymous uploads.
  // Customers at checkout (no session) upload comprobantes; everything else
  // requires either a user session or admin session.
  const contentType = request.headers.get("content-type") || "";
  let earlyType: string | null = null;
  if (contentType.includes("multipart/form-data")) {
    // We can't peek at FormData without consuming the body, so we just
    // skip the auth-bypass here and infer below.
  }

  // Accept either user session or admin session — OR anonymous if the upload
  // is a comprobante (customer payment receipt). The comprobante guard relies
  // on POST /api/orders validating that the resulting URL is on our R2 bucket
  // before binding it to an order.
  const session = await getSession();
  const adminSession = await getAdminSession();
  const isAnon = !session && !adminSession;

  // Use activeSlug for the folder, or admin folder, or anonymous-uploads
  const folder = session?.activeSlug
    || (adminSession ? "admin-uploads" : null)
    || `user-${session?.userId.slice(0, 8) || "anon"}`;

  // JSON body = URL resolve (always requires auth — used for admin /
  // owner-side image imports from external URLs).
  if (contentType.includes("application/json")) {
    if (isAnon) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const body = await request.json();
    const { imageUrl, type } = body; // type: "logo" | "cover" | "menu-item"

    if (!imageUrl) {
      return NextResponse.json({ error: "Falta imageUrl" }, { status: 400 });
    }

    const ext = getExtFromUrl(imageUrl);
    const key = `${folder}/${type || "image"}-${Date.now()}.${ext}`;

    try {
      const url = await resolveUrlToR2(imageUrl, key);
      return NextResponse.json({ url, key });
    } catch (err) {
      console.error("URL resolve error:", err);
      return NextResponse.json({ error: "No se pudo descargar la imagen" }, { status: 400 });
    }
  }

  // FormData = file upload
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const type = formData.get("type") as string || "image";

  if (!file) {
    return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });
  }

  // Anonymous uploads are restricted to comprobantes only (image-only, stored
  // under guests/ folder so they're easy to audit). Everything else needs auth.
  if (isAnon) {
    if (type !== "comprobante") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }
  const folderForRequest = isAnon ? "guests" : folder;

  // Validate file type (images + video)
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/") || file.name.toLowerCase().endsWith(".mp4");
  if (!isImage && !isVideo) {
    return NextResponse.json({ error: "Solo se permiten imágenes y videos (mp4)" }, { status: 400 });
  }

  // Max 5MB for images, 20MB for videos
  const maxSize = isVideo ? 20 * 1024 * 1024 : 5 * 1024 * 1024;
  if (file.size > maxSize) {
    return NextResponse.json({ error: isVideo ? "Máximo 20MB para videos" : "Máximo 5MB para imágenes" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const key = `${folderForRequest}/${type}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const url = await uploadToR2(buffer, key, file.type);
    return NextResponse.json({ url, key });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Error al subir la imagen" }, { status: 500 });
  }
}
