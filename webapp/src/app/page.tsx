import { PublicBotChat } from "@/components/PublicBotChat";

export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "MenuSanJuan",
    url: "https://menusanjuan.com",
    description: "Todos los menús de San Juan en un solo lugar. Elegí, pedí por WhatsApp y listo.",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PublicBotChat />
    </>
  );
}
