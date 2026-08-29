"use client";

import { Plus, Minus } from "lucide-react";

// Shared quantity stepper — one control with pluggable state. Parent owns
// the logic (integer count for FIXED, {tierIndex, jarCount} for PACKAGED,
// weight in `step` increments for BY_WEIGHT) and hands the stepper:
//   • what to render in the middle (label = e.g. "1× ¼ kg" or "0,5 kg")
//   • what to do on +/- taps
//   • whether - is disabled (already at min)
//
// Styled to match the current inline "- N +" pattern used across the
// customize sheet, cart row, and POS. size="lg" is the customize-sheet
// footer; "md" is the cart row.

type Props = {
  label: React.ReactNode;
  onIncrement: () => void;
  onDecrement: () => void;
  decrementDisabled?: boolean;
  incrementDisabled?: boolean;
  size?: "md" | "lg";
  hint?: React.ReactNode;
  ariaLabel?: string;
};

export function QuantityStepper({
  label,
  onIncrement,
  onDecrement,
  decrementDisabled,
  incrementDisabled,
  size = "md",
  hint,
  ariaLabel,
}: Props) {
  const btnSize = size === "lg" ? "h-11 w-11" : "h-7 w-7";
  const iconSize = size === "lg" ? "h-5 w-5" : "h-3.5 w-3.5";
  const labelSize = size === "lg" ? "text-base font-bold" : "text-sm font-bold";
  return (
    <div className="inline-flex flex-col items-center gap-1" aria-label={ariaLabel}>
      <div className="inline-flex items-center gap-3">
        <button
          type="button"
          onClick={onDecrement}
          disabled={decrementDisabled}
          className={`flex ${btnSize} items-center justify-center rounded-full border border-border text-text-secondary hover:border-primary hover:text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          <Minus className={iconSize} />
        </button>
        <span className={`${labelSize} text-text min-w-[3.5rem] text-center tabular-nums`}>{label}</span>
        <button
          type="button"
          onClick={onIncrement}
          disabled={incrementDisabled}
          className={`flex ${btnSize} items-center justify-center rounded-full bg-primary text-white shadow-sm hover:shadow-md transition-all disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          <Plus className={iconSize} />
        </button>
      </div>
      {hint && <div className="text-[10px] text-text-muted mt-0.5">{hint}</div>}
    </div>
  );
}
