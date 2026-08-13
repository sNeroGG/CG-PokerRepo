import type { Metadata, Viewport } from "next";
import { Cinzel, Manrope } from "next/font/google";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { CardFaceStyleBoot } from "@/components/cards/CardFaceStyleBoot";
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
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark",
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${manrope.variable} ${cinzel.variable} card-face-style-white`} data-card-face-style="white">
      <body className="font-sans">
        <CardFaceStyleBoot />
        {children}
      </body>
    </html>
  );
}
