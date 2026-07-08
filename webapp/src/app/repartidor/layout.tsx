import type { Metadata, Viewport } from "next";

// The repartidor (driver) PWA is not indexable — it's a private, credentialed
// tool for the delivery network. Keep it out of Google + link previews so the
// login form never surfaces publicly.
export const metadata: Metadata = {
  title: "MenuSanJuan Repartidor",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

// Viewport lock: PWA / mobile-first. `maximumScale: 1` + `userScalable: false`
// keeps iOS Safari from zooming when a driver taps a small input on a rainy
// glass screen. Overrides whatever the root layout defaults to.
export function generateViewport(): Viewport {
  return {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    themeColor: "#0f172a",
    colorScheme: "dark",
  };
}

export default function RepartidorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Full-screen dark shell. `min-h-dvh` (dynamic viewport height) prevents the
  // mobile chrome bar from shifting the layout mid-scroll on iOS Safari, which
  // matters because drivers use one-handed thumb interactions. No global
  // nav/header/footer — every route under /repartidor manages its own chrome.
  return (
    <div className="min-h-dvh bg-slate-950 text-white">
      {children}
    </div>
  );
}
