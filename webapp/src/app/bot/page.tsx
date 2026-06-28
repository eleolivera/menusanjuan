import type { Metadata } from "next";
import { PublicBotChat } from "@/components/PublicBotChat";

// Hidden bot entry point. Used to live at the apex / route but moved here so
// the homepage can serve marketing content instead. Only people who know the
// /bot URL find it — by design, not promoted.
export const metadata: Metadata = {
  title: "MenuBot — Concierge de comida en San Juan",
  description: "Asistente para descubrir qué comer en San Juan.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function BotPage() {
  return <PublicBotChat />;
}
