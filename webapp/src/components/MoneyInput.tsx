"use client";

import { useState, useEffect, useRef } from "react";

export function MoneyInput({
  value,
  onChange,
  onBlur,
  placeholder = "1500",
  label,
  statusIndicator,
  darkMode = false,
  allowDecimals = false,
  className,
  required = false,
  disabled = false,
  compact = false,
  prefix = "$",
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  onBlur?: () => void;
  placeholder?: string;
  label?: string;
  statusIndicator?: React.ReactNode;
  darkMode?: boolean;
  allowDecimals?: boolean;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  compact?: boolean;
  prefix?: string;
}) {
  const [text, setText] = useState<string>(value != null ? String(value) : "");
  const focusedRef = useRef(false);

  // Sync from external when value changes (e.g. async load) — but only when NOT focused,
  // so we don't fight the user mid-typing.
  useEffect(() => {
    if (focusedRef.current) return;
    const next = value != null ? String(value) : "";
    if (next !== text) setText(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handleChange(s: string) {
    // Allow digits and (optionally) one decimal separator. Normalize comma → dot.
    let cleaned = allowDecimals
      ? s.replace(/[^\d.,]/g, "").replace(",", ".")
      : s.replace(/\D/g, "");

    // Collapse multiple decimal points to the first one
    if (allowDecimals) {
      const firstDot = cleaned.indexOf(".");
      if (firstDot !== -1) {
        cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
      }
    }

    // Strip leading zeros (except "0." for decimals)
    if (allowDecimals && cleaned.startsWith("0") && !cleaned.startsWith("0.")) {
      cleaned = cleaned.replace(/^0+(?=\d)/, "");
    } else if (!allowDecimals) {
      cleaned = cleaned.replace(/^0+(?=\d)/, "");
    }

    setText(cleaned);

    if (cleaned === "" || cleaned === ".") {
      onChange(null);
    } else {
      const parsed = Number(cleaned);
      onChange(isNaN(parsed) ? null : parsed);
    }
  }

  // ARS thousand-separator preview hint shown on the right
  const previewHint = value != null && value !== 0
    ? value.toLocaleString("es-AR", { minimumFractionDigits: allowDecimals && !Number.isInteger(value) ? 2 : 0 })
    : null;

  const inputBase = darkMode
    ? "border border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
    : "border border-border bg-white text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className={className}>
      {label && (
        <label className={`mb-1.5 flex items-center text-xs font-medium ${darkMode ? "text-slate-400" : "text-text"}`}>
          <span>{label} {required && <span className="text-danger">*</span>}</span>
          {statusIndicator}
        </label>
      )}
      <div className="relative">
        <span className={`absolute ${compact ? "left-2 text-xs" : "left-3 text-sm"} top-1/2 -translate-y-1/2 pointer-events-none ${darkMode ? "text-slate-500" : "text-text-muted"}`}>{prefix}</span>
        <input
          type="text"
          inputMode={allowDecimals ? "decimal" : "numeric"}
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => { focusedRef.current = true; }}
          onBlur={() => { focusedRef.current = false; onBlur?.(); }}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full ${compact ? "pl-6 pr-2 py-1.5 text-xs rounded-lg" : "pl-7 pr-3 py-3 text-sm rounded-xl"} transition-colors ${inputBase} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        />
        {previewHint && !compact && (
          <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] pointer-events-none ${darkMode ? "text-slate-500" : "text-text-muted"}`}>
            {previewHint}
          </span>
        )}
      </div>
    </div>
  );
}
