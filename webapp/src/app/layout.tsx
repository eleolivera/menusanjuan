import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
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
  // Icons: `favicon.ico` at src/app/ handles legacy /favicon.ico direct
  // requests (link preview crawlers, first paint). SVG is emitted as an
  // additional <link> for crisp scaling on modern browsers. Per-resta pages
  // override this via their own generateMetadata to use dealer.logoUrl.
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
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
    // Default preview image for any page that doesn't set its own openGraph.
    // Previously null → WhatsApp/iMessage showed a generic card with no image.
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "MenuSanJuan" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "MenuSanJuan — Pedí comida en San Juan",
    description: "Todos los menús de San Juan en un solo lugar.",
    images: ["/icon-512.png"],
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
        {/* Free-tier pageview tracking. Beacon-style — zero perf cost,
            no cookies, GDPR-clean. Dashboard at vercel.com/menusanjuan/analytics. */}
        <Analytics />
      </body>
    </html>
  );
}
