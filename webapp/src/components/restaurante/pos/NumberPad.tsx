"use client";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  /** Show only digits 0-9 (no decimal). Default: true */
  integerOnly?: boolean;
  /** Max length of the value string */
  maxLength?: number;
};

export function NumberPad({ value, onChange, onEnter, integerOnly = true, maxLength = 8 }: Props) {
  function press(digit: string) {
    if (value.length >= maxLength) return;
    onChange(value + digit);
  }
  function backspace() {
    onChange(value.slice(0, -1));
  }
  function clear() {
    onChange("");
  }

  return (
    <div className="grid grid-cols-3 gap-2 select-none">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => press(d)}
          className="rounded-xl border border-white/10 bg-white/5 py-4 text-2xl font-bold text-white hover:bg-white/10 active:scale-95 transition-all"
        >
          {d}
        </button>
      ))}
      <button
        type="button"
        onClick={clear}
        className="rounded-xl border border-white/10 bg-white/5 py-4 text-xs font-semibold text-slate-400 hover:bg-white/10 active:scale-95 transition-all"
      >
        Limpiar
      </button>
      <button
        type="button"
        onClick={() => press("0")}
        className="rounded-xl border border-white/10 bg-white/5 py-4 text-2xl font-bold text-white hover:bg-white/10 active:scale-95 transition-all"
      >
        0
      </button>
      <button
        type="button"
        onClick={backspace}
        className="rounded-xl border border-white/10 bg-white/5 py-4 text-xl font-bold text-slate-400 hover:bg-white/10 active:scale-95 transition-all"
      >
        ⌫
      </button>
      {onEnter && (
        <button
          type="button"
          onClick={onEnter}
          className="col-span-3 rounded-xl bg-gradient-to-r from-primary to-amber-500 py-4 text-base font-bold text-white shadow-md shadow-primary/25 hover:shadow-lg active:scale-95 transition-all"
        >
          Confirmar
        </button>
      )}
    </div>
  );
}
