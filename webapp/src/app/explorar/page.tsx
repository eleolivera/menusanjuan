import { HeroSection } from "@/components/HeroSection";
import { RestaurantGrid } from "@/components/RestaurantGrid";
import { HowItWorks } from "@/components/HowItWorks";

export const metadata = {
  title: "Explorar menús — MenuSanJuan",
  description: "Todos los menús de San Juan en un solo lugar. Buscá tu restaurante, pedí por WhatsApp.",
};

export default function Explorar() {
  return (
    <div className="mesh-gradient">
      <HeroSection />
      <RestaurantGrid />
      <HowItWorks />
    </div>
  );
}
