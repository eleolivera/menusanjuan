"use client";

export function FloatingCart({
  itemCount,
  total,
  onClick,
  pendingOrderNumber,
  onViewOrder,
}: {
  itemCount: number;
  total: number;
  onClick: () => void;
  pendingOrderNumber?: string | null;
  onViewOrder?: () => void;
}) {
  // Show "Ver mi pedido" when there's a pending order and cart is empty
  if (itemCount === 0 && pendingOrderNumber && onViewOrder) {
    return (
      <button
        onClick={onViewOrder}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-3.5 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:-translate-y-0.5 transition-all animate-scale-in"
      >
        <span className="text-lg">📋</span>
        <div className="text-left">
          <div className="text-xs font-medium opacity-80">Tu pedido</div>
          <div className="text-sm font-bold tracking-tight">{pendingOrderNumber}</div>
        </div>
      </button>
    );
  }

  if (itemCount === 0) return null;

  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-primary to-amber-500 px-5 py-3.5 text-white shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 transition-all animate-scale-in"
    >
      <div className="relative">
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
        </svg>
        <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-bold text-primary">
          {itemCount}
        </span>
      </div>
      <div className="text-left">
        <div className="text-xs font-medium opacity-80">Tu pedido</div>
        <div className="text-sm font-bold tracking-tight">
          ${total.toLocaleString("es-AR")}
        </div>
      </div>
    </button>
  );
}
