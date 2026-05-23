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
  /** Format a number into es-AR style with thousand separators (1.500). For
   * decimals we show the user's typed precision; for ints we omit trailing zeros. */
  function format(n: number): string {
    if (!Number.isFinite(n)) return "";
    return n.toLocaleString("es-AR", {
      minimumFractionDigits: allowDecimals && !Number.isInteger(n) ? 2 : 0,
      maximumFractionDigits: allowDecimals ? 2 : 0,
    });
  }

  // Two display modes:
  //   - focused: raw digits ("6000") — easy to edit, no cursor jumps from re-formatting
  //   - blurred: formatted ("6.000") — what owners are used to seeing on receipts
  // We toggle between them on focus/blur so editing is intuitive but the at-rest
  // display matches the rest of the app's es-AR currency formatting.
  const [text, setText] = useState<string>(value != null ? format(value) : "");
  const focusedRef = useRef(false);

  // Sync from external when value changes (e.g. async load) — but only when NOT focused,
  // so we don't fight the user mid-typing.
  useEffect(() => {
    if (focusedRef.current) return;
    const next = value != null ? format(value) : "";
    if (next !== text) setText(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handleChange(s: string) {
    // Allow digits and (optionally) one decimal separator. Normalize comma → dot.
    // Dots are stripped because they're thousand separators in es-AR, NOT the
    // decimal separator. allowDecimals uses comma; we normalize to dot internally.
    let cleaned = allowDecimals
      ? s.replace(/[^\d,.]/g, "").replace(/\./g, "").replace(",", ".")
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

    // While focused, keep raw digits in the input so the cursor doesn't jump
    // around as the user types.
    setText(cleaned);

    if (cleaned === "" || cleaned === ".") {
      onChange(null);
    } else {
      const parsed = Number(cleaned);
      onChange(isNaN(parsed) ? null : parsed);
    }
  }

  function onFocusInput() {
    focusedRef.current = true;
    // Switch from formatted display ("6.000") to raw digits ("6000") for editing
    if (value != null) setText(String(value));
  }

  function onBlurInput() {
    focusedRef.current = false;
    // Reformat to es-AR thousand-separator style so the at-rest view is consistent
    if (value != null) setText(format(value));
    onBlur?.();
  }

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
          onFocus={onFocusInput}
          onBlur={onBlurInput}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full ${compact ? "pl-6 pr-2 py-1.5 text-xs rounded-lg" : "pl-7 pr-3 py-3 text-sm rounded-xl"} transition-colors ${inputBase} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        />
      </div>
    </div>
  );
}
