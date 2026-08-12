"use client";

import { useEffect } from "react";
import {
  applyCardFaceStyleClass,
  getStoredCardFaceStyle,
} from "@/lib/card-face-style";

/** Aplica la preferencia guardada (default blanco) en toda la app. */
export function CardFaceStyleBoot() {
  useEffect(() => {
    applyCardFaceStyleClass(getStoredCardFaceStyle());
  }, []);

  return null;
}
