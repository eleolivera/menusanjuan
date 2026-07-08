// Client-side image resize + recompress. Runs entirely in the browser via
// canvas — no server round-trip. Used by uploaders (admin, owner profile,
// menu-item images) BEFORE POSTing to /api/upload so we never ship a 5 MB
// original when 30 KB will do. Also stops Vercel's 4.5 MB body limit from
// silently 413'ing large phone-camera JPEGs.
//
// Contract:
//   - Preserves aspect ratio.
//   - Skips work entirely if the source is already within (maxWidth × maxHeight).
//   - Always outputs JPEG (logos/covers rarely need alpha and JPEG compresses ~5×
//     smaller than PNG for photos).

export type ResizeOpts = {
  maxWidth: number;
  maxHeight: number;
  quality?: number; // 0..1 for JPEG, defaults to 0.9
};

export async function resizeImageForUpload(
  file: File,
  opts: ResizeOpts,
): Promise<File> {
  const { maxWidth, maxHeight, quality = 0.9 } = opts;

  const bitmap = await createBitmap(file);
  const srcW = bitmap.width;
  const srcH = bitmap.height;

  const scale = Math.min(1, maxWidth / srcW, maxHeight / srcH);
  const dstW = Math.round(srcW * scale);
  const dstH = Math.round(srcH * scale);

  // Already small enough AND source is JPEG → skip resize entirely.
  if (scale >= 1 && file.type === "image/jpeg") {
    bitmap.close?.();
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = dstW;
  canvas.height = dstH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    throw new Error("no_canvas_context");
  }
  // Fill with white so any transparent source doesn't come out black in JPEG.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, dstW, dstH);
  ctx.drawImage(bitmap, 0, 0, dstW, dstH);
  bitmap.close?.();

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("canvas_toBlob_failed"))),
      "image/jpeg",
      quality,
    ),
  );

  const outName = file.name.replace(/\.(png|webp|gif|heic|heif|jpg|jpeg)$/i, "") + ".jpg";
  return new File([blob], outName, { type: "image/jpeg" });
}

async function createBitmap(file: File): Promise<ImageBitmap> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // fall through to img fallback
    }
  }
  // Fallback for older Safari where createImageBitmap on a Blob throws.
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("image_load_failed"));
      i.src = url;
    });
    return await createImageBitmap(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}
