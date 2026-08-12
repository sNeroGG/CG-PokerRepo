"use client";

import { useCallback, useEffect, useState } from "react";
import {
  applyCardFaceStyleClass,
  DEFAULT_CARD_FACE_STYLE,
  getStoredCardFaceStyle,
  setStoredCardFaceStyle,
  type CardFaceStyleId,
} from "@/lib/card-face-style";

/** Preferencia local de cara de carta (blanco/negro). Default: blanco. */
export function useCardFaceStyle() {
  const [style, setStyleState] = useState<CardFaceStyleId>(DEFAULT_CARD_FACE_STYLE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = getStoredCardFaceStyle();
    setStyleState(stored);
    applyCardFaceStyleClass(stored);
    setReady(true);
  }, []);

  const setStyle = useCallback((next: CardFaceStyleId) => {
    setStyleState(next);
    setStoredCardFaceStyle(next);
    applyCardFaceStyleClass(next);
  }, []);

  return { style, setStyle, ready };
}
