"use client";

type OrderStatus = "GENERATED" | "PAID" | "PROCESSING" | "DELIVERED" | "CANCELLED";

const STEPS = [
  { key: "GENERATED", label: "Generado", emoji: "📋" },
  { key: "PAID", label: "Pagado", emoji: "💰" },
  { key: "PROCESSING", label: "En Preparación", emoji: "👨‍🍳" },
  { key: "DELIVERED", label: "Entregado", emoji: "✅" },
] as const;

const STATUS_ORDER: Record<string, number> = {
  GENERATED: 0,
  PAID: 1,
  PROCESSING: 2,
  DELIVERED: 3,
};

export function OrderStatusStepper({ status }: { status: OrderStatus }) {
  if (status === "CANCELLED") {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
        <span className="text-lg">❌</span>
        <span className="text-sm font-bold text-red-700">Pedido Cancelado</span>
      </div>
    );
  }

  const currentIdx = STATUS_ORDER[status] ?? 0;
  // If status jumped from GENERATED to PROCESSING (cash order), skip PAID
  const skippedPaid = status === "PROCESSING" && currentIdx === 2;

  return (
    <div className="flex items-center justify-between gap-1">
      {STEPS.map((step, i) => {
        const isComplete = i <= currentIdx;
        const isCurrent = i === currentIdx;
        const isSkipped = step.key === "PAID" && skippedPaid;

        return (
          <div key={step.key} className="flex flex-1 flex-col items-center">
            {/* Dot/icon */}
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full text-base transition-all ${
                isCurrent
                  ? "bg-primary text-white shadow-md shadow-primary/25 scale-110"
                  : isComplete
                  ? "bg-primary/15 text-primary"
                  : isSkipped
                  ? "bg-gray-100 text-gray-300"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {step.emoji}
            </div>
            {/* Label */}
            <span
              className={`mt-1.5 text-[10px] font-medium text-center leading-tight ${
                isCurrent
                  ? "text-primary font-bold"
                  : isComplete
                  ? "text-text-secondary"
                  : isSkipped
                  ? "text-gray-300 line-through"
                  : "text-text-muted"
              }`}
            >
              {isSkipped ? "—" : step.label}
            </span>
            {/* Connector line */}
            {i < STEPS.length - 1 && (
              <div
                className={`mt-1 h-0.5 w-full ${
                  i < currentIdx ? "bg-primary/30" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
