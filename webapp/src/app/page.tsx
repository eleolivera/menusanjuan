import { HeroSection } from "@/components/HeroSection";
import { RestaurantGrid } from "@/components/RestaurantGrid";
import { HowItWorks } from "@/components/HowItWorks";

export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "MenuSanJuan",
    url: "https://menusanjuan.com",
    description: "Todos los menús de San Juan en un solo lugar. Elegí, pedí por WhatsApp y listo.",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://menusanjuan.com/?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <div className="mesh-gradient">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HeroSection />
      <RestaurantGrid />
      <HowItWorks />
    </div>
  );
}
