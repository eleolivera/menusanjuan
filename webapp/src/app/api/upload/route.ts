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
  // Accept either user session or admin session
  const session = await getSession();
  const adminSession = await getAdminSession();
  if (!session && !adminSession) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Use activeSlug for the folder, or admin folder
  const folder = session?.activeSlug || (adminSession ? "admin-uploads" : `user-${session?.userId.slice(0, 8)}`);
  const contentType = request.headers.get("content-type") || "";

  // JSON body = URL resolve
  if (contentType.includes("application/json")) {
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
  const key = `${folder}/${type}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const url = await uploadToR2(buffer, key, file.type);
    return NextResponse.json({ url, key });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Error al subir la imagen" }, { status: 500 });
  }
}
