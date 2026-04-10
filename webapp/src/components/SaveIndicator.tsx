"use client";

type FieldStatus = "idle" | "saving" | "saved" | "error";

export function SaveIndicator({ status }: { status: FieldStatus }) {
  if (status === "idle") return null;

  return (
    <span className="inline-flex items-center ml-2 text-[10px] font-medium animate-fade-in">
      {status === "saving" && (
        <span className="text-text-muted flex items-center gap-1">
          <span className="h-2.5 w-2.5 animate-spin rounded-full border border-text-muted border-t-transparent" />
        </span>
      )}
      {status === "saved" && (
        <span className="text-emerald-500">Guardado ✓</span>
      )}
      {status === "error" && (
        <span className="text-red-500">Error</span>
      )}
    </span>
  );
}
