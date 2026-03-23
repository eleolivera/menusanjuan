import { NextRequest, NextResponse } from "next/server";
import { uploadToR2, resolveUrlToR2 } from "@/lib/r2";
import { getRestauranteSession } from "@/lib/restaurante-auth";

// POST — upload image (file or URL)
export async function POST(request: NextRequest) {
  const session = await getRestauranteSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") || "";

  // JSON body = URL resolve
  if (contentType.includes("application/json")) {
    const body = await request.json();
    const { imageUrl, type } = body; // type: "logo" | "cover" | "menu-item"

    if (!imageUrl) {
      return NextResponse.json({ error: "Falta imageUrl" }, { status: 400 });
    }

    const ext = imageUrl.match(/\.(jpg|jpeg|png|webp|gif)/i)?.[1] || "jpg";
    const key = `${session.slug}/${type || "image"}-${Date.now()}.${ext}`;

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

  // Validate file type
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Solo se permiten imágenes" }, { status: 400 });
  }

  // Max 5MB
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Máximo 5MB" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() || "jpg";
  const key = `${session.slug}/${type}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const url = await uploadToR2(buffer, key, file.type);
    return NextResponse.json({ url, key });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Error al subir la imagen" }, { status: 500 });
  }
}
