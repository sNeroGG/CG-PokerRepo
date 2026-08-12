import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { CardFaceStyleBoot } from "@/components/cards/CardFaceStyleBoot";
import "./globals.css";
import "@/components/ui/landscape-mode.css";
import "@/components/cards/card-face-themes.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
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
    <html lang="es" className={`${inter.variable} ${playfair.variable} card-face-style-white`} data-card-face-style="white">
      <body className="font-sans">
        <CardFaceStyleBoot />
        {children}
      </body>
    </html>
  );
}
