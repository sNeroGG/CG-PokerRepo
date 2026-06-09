/**
 * Rutas de assets de marca — coloca tus archivos en /public/brand/
 *
 * logo.png          → Logo principal (header, sidebar)
 * table-felt.jpg    → Textura/imagen de fondo del felt
 * table-watermark.png → Marca de agua centrada en la mesa
 * hero-bg.jpg       → Fondo opcional de pantallas (lobby/auth)
 */
export const BRAND_NAME = "CHOLOS GROUP CORPORATION";
export const BRAND_NAME_SHORT = "CGC";
export const BRAND_TAGLINE = "Poker & Blackjack";

export const BRAND_ASSETS = {
  logo: "/brand/logo.png",
  tableFelt: "/brand/table-felt.jpg",
  tableWatermark: "/brand/table-watermark.png",
  heroBackground: "/brand/hero-bg.jpg",
} as const;

export const BRAND_COLORS = {
  gold: "#d4af37",
  goldLight: "#f0d060",
  black: "#0a0a0a",
  white: "#faf8f5",
} as const;
