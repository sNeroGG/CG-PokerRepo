"use client";

import { useEffect, useState } from "react";

/** Activa estilos móvil (vertical u horizontal) al entrar al juego. */
export function useGameLandscape() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth <= 900);
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  useEffect(() => {
    if (!isMobile) return;

    document.documentElement.classList.add("mobile-play-mode");

    return () => {
      document.documentElement.classList.remove("mobile-play-mode");
    };
  }, [isMobile]);

  return { isMobile };
}
