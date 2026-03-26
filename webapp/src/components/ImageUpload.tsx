"use client";

import { useState, useRef } from "react";

export function ImageUpload({
  value,
  onChange,
  type = "logo",
  label,
  shape = "cover",
}: {
  value: string;
  onChange: (url: string) => void;
  type?: "logo" | "cover" | "menu-item";
  label: string;
  shape?: "logo" | "cover";
}) {
  const [uploading, setUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileUpload(file: File) {
    setUploading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      onChange(data.url);
    } catch {
      setError("Error al subir la imagen");
    } finally {
      setUploading(false);
    }
  }

  async function handleUrlSubmit() {
    if (!urlInput.trim()) return;
    setUploading(true);
    setError("");

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: urlInput, type }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      onChange(data.url);
      setUrlInput("");
      setShowUrlInput(false);
    } catch {
      setError("Error al procesar la URL");
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/") || file?.type.startsWith("video/")) handleFileUpload(file);
  }

  const isVideo = value && (value.endsWith(".mp4") || value.endsWith(".mov") || value.endsWith(".webm"));

  const isLogo = shape === "logo";

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-text">{label}</label>

      {/* Preview + Upload area */}
      <div
        onClick={() => !uploading && fileRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className={`relative cursor-pointer border-2 border-dashed border-border/60 hover:border-primary/40 transition-all overflow-hidden ${
          isLogo ? "h-24 w-24 rounded-2xl" : "h-36 w-full rounded-xl"
        } ${uploading ? "opacity-50 pointer-events-none" : ""}`}
      >
        {value ? (
          isVideo ? (
            <video src={value} className="h-full w-full object-cover" autoPlay loop muted playsInline />
          ) : (
            <img src={value} alt="" className="h-full w-full object-cover" />
          )
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center bg-surface-alt">
            <svg className="h-6 w-6 text-text-muted mb-1" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
            </svg>
            <span className="text-[11px] text-text-muted">
              {isLogo ? "Logo" : "Arrastrá o hacé click"}
            </span>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
          </div>
        )}

        {/* Remove button */}
        {value && !uploading && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
            className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1 text-white hover:bg-black/80 transition-colors"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/mp4,video/quicktime,video/webm"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file);
          e.target.value = "";
        }}
      />

      {/* URL alternative */}
      <div className="mt-2 flex items-center gap-2">
        {!showUrlInput ? (
          <button
            type="button"
            onClick={() => setShowUrlInput(true)}
            className="text-[11px] text-text-muted hover:text-primary transition-colors"
          >
            O pegá una URL de imagen
          </button>
        ) : (
          <div className="flex gap-2 w-full">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://..."
              className="flex-1 rounded-lg border border-border bg-white px-3 py-1.5 text-xs text-text placeholder:text-text-muted focus:border-primary focus:outline-none transition-colors"
            />
            <button
              type="button"
              onClick={handleUrlSubmit}
              disabled={uploading || !urlInput.trim()}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              {uploading ? "..." : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => { setShowUrlInput(false); setUrlInput(""); }}
              className="rounded-lg border border-border px-2 py-1.5 text-xs text-text-muted hover:bg-surface-hover transition-colors"
            >
              x
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-1 text-xs text-danger">{error}</p>
      )}
    </div>
  );
}
