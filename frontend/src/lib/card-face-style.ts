/** Estilos de cara de carta — extensible (más temas en el futuro). */
export const CARD_FACE_STYLES = [
  {
    id: "white",
    label: "Cartas blancas",
    description: "Clásicas, fondo crema",
    swatch: "#faf8f5",
    border: "#d8d4cc",
  },
  {
    id: "black",
    label: "Cartas negras",
    description: "Oscuras, borde claro",
    swatch: "#1a1a1a",
    border: "rgba(255,255,255,0.35)",
  },
] as const;

export type CardFaceStyleId = (typeof CARD_FACE_STYLES)[number]["id"];

export const DEFAULT_CARD_FACE_STYLE: CardFaceStyleId = "white";
export const CARD_FACE_STYLE_KEY = "cg-card-face-style";
export const CARD_FACE_STYLE_CLASS_PREFIX = "card-face-style-";

export function isCardFaceStyleId(value: unknown): value is CardFaceStyleId {
  return CARD_FACE_STYLES.some((s) => s.id === value);
}

export function getStoredCardFaceStyle(): CardFaceStyleId {
  if (typeof window === "undefined") return DEFAULT_CARD_FACE_STYLE;
  const raw = localStorage.getItem(CARD_FACE_STYLE_KEY);
  return isCardFaceStyleId(raw) ? raw : DEFAULT_CARD_FACE_STYLE;
}

export function setStoredCardFaceStyle(style: CardFaceStyleId): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CARD_FACE_STYLE_KEY, style);
  window.dispatchEvent(new Event("cg-card-face-style-change"));
}

export function applyCardFaceStyleClass(style: CardFaceStyleId): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const s of CARD_FACE_STYLES) {
    root.classList.remove(`${CARD_FACE_STYLE_CLASS_PREFIX}${s.id}`);
  }
  root.classList.add(`${CARD_FACE_STYLE_CLASS_PREFIX}${style}`);
  root.dataset.cardFaceStyle = style;
}

/** SVG data-URI: Force Dark de Android no invierte imágenes como fondos CSS. */
export function cardFaceFillDataUri(style: CardFaceStyleId): string {
  const fill = style === "black" ? "#1a1a1a" : "#faf8f5";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="140"><rect width="100%" height="100%" rx="10" fill="${fill}"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
