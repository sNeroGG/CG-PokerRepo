import type { Metadata, Viewport } from "next";
import { Cinzel, Manrope } from "next/font/google";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { CardFaceStyleBoot } from "@/components/cards/CardFaceStyleBoot";
import { PwaRegistration } from "@/components/pwa/PwaRegistration";
import "./globals.css";
import "@/components/ui/landscape-mode.css";
import "@/components/cards/card-face-themes.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });
const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: `${BRAND_NAME} — ${BRAND_TAGLINE}`,
  description: `${BRAND_NAME} — ${BRAND_TAGLINE} multijugador con salas por código`,
  applicationName: BRAND_NAME,
  manifest: "/manifest.webmanifest",
  formatDetection: {
    telephone: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: BRAND_NAME,
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/pwa/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/pwa/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark",
  themeColor: "#060606",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${manrope.variable} ${cinzel.variable} card-face-style-white`} data-card-face-style="white">
      <body className="font-sans">
        <CardFaceStyleBoot />
        <PwaRegistration />
        {children}
      </body>
    </html>
  );
}
