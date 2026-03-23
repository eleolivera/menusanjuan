import { HeroSection } from "@/components/HeroSection";
import { RestaurantGrid } from "@/components/RestaurantGrid";
import { HowItWorks } from "@/components/HowItWorks";

export default function Home() {
  return (
    <div className="mesh-gradient">
      <HeroSection />
      <RestaurantGrid />
      <HowItWorks />
    </div>
  );
}
