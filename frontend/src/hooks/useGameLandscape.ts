"use client";

import { useEffect, useState } from "react";

/** Altura visible real (Android/iOS chrome + barra de sistema). */
function syncAppHeight() {
  const h = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty("--app-height", `${Math.round(h)}px`);
}

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
    syncAppHeight();

    const vv = window.visualViewport;
    vv?.addEventListener("resize", syncAppHeight);
    vv?.addEventListener("scroll", syncAppHeight);
    window.addEventListener("resize", syncAppHeight);
    window.addEventListener("orientationchange", syncAppHeight);

    return () => {
      document.documentElement.classList.remove("mobile-play-mode");
      document.documentElement.style.removeProperty("--app-height");
      vv?.removeEventListener("resize", syncAppHeight);
      vv?.removeEventListener("scroll", syncAppHeight);
      window.removeEventListener("resize", syncAppHeight);
      window.removeEventListener("orientationchange", syncAppHeight);
    };
  }, [isMobile]);

  return { isMobile };
}
