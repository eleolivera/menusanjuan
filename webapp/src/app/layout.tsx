import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ConditionalChrome } from "@/components/ConditionalChrome";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "MenuSanJuan — Pedí comida en San Juan",
    template: "%s | MenuSanJuan",
  },
  description:
    "Todos los menús de San Juan en un solo lugar. Elegí, pedí por WhatsApp y listo.",
  icons: {
    icon: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  metadataBase: new URL("https://menusanjuan.com"),
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: "MenuSanJuan",
    title: "MenuSanJuan — Pedí comida en San Juan",
    description: "Todos los menús de San Juan en un solo lugar. Elegí, pedí por WhatsApp y listo.",
  },
  twitter: {
    card: "summary_large_image",
    title: "MenuSanJuan — Pedí comida en San Juan",
    description: "Todos los menús de San Juan en un solo lugar.",
  },
  keywords: [
    "restaurantes san juan",
    "menú san juan",
    "pedir comida san juan",
    "delivery san juan argentina",
    "comida a domicilio san juan",
    "whatsapp delivery san juan",
    "restaurantes argentina",
  ],
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <ConditionalChrome>{children}</ConditionalChrome>
      </body>
    </html>
  );
}
