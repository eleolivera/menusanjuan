// ─── Shared admin configuration ───

export type OnboardingStage = "NEEDS_INFO" | "READY" | "QUEUED" | "IN_PROGRESS" | "ONBOARDED";

export const ONBOARDING_STAGES: { key: OnboardingStage; label: string; color: string; bgColor: string; description: string }[] = [
  { key: "NEEDS_INFO", label: "Falta info", color: "text-amber-400", bgColor: "bg-amber-400/10 border-amber-400/20", description: "Faltan fotos, direccion, WhatsApp o menu" },
  { key: "READY", label: "Listo", color: "text-blue-400", bgColor: "bg-blue-400/10 border-blue-400/20", description: "Info completa, listo para contactar al dueno" },
  { key: "QUEUED", label: "Cola de contacto", color: "text-purple-400", bgColor: "bg-purple-400/10 border-purple-400/20", description: "En cola para enviar mensaje / activar cuenta" },
  { key: "IN_PROGRESS", label: "En charla", color: "text-cyan-400", bgColor: "bg-cyan-400/10 border-cyan-400/20", description: "Ya contactamos, en conversacion" },
  { key: "ONBOARDED", label: "Onboardeado", color: "text-emerald-400", bgColor: "bg-emerald-400/10 border-emerald-400/20", description: "Activo y verificado" },
];

export const ORDER_STATUSES: { status: "GENERATED" | "PAID" | "PROCESSING" | "DELIVERED" | "CANCELLED"; label: string; color: string; bgColor: string }[] = [
  { status: "GENERATED", label: "Nuevo", color: "text-amber-400", bgColor: "bg-amber-400/10 border-amber-400/20" },
  { status: "PAID", label: "Pagado", color: "text-emerald-400", bgColor: "bg-emerald-400/10 border-emerald-400/20" },
  { status: "PROCESSING", label: "En Cocina", color: "text-blue-400", bgColor: "bg-blue-400/10 border-blue-400/20" },
  { status: "DELIVERED", label: "Entregado", color: "text-slate-400", bgColor: "bg-slate-400/10 border-slate-400/20" },
  { status: "CANCELLED", label: "Cancelado", color: "text-red-400", bgColor: "bg-red-400/10 border-red-400/20" },
];

export const WHATSAPP_BUSINESS = "+5492644583918";
