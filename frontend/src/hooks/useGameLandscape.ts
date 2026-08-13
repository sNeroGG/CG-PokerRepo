"use client";

import { useEffect, useState } from "react";

/** Activa estilos móvil (vertical u horizontal) al entrar al juego. */
export function useGameLandscape() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 900px)");
    const update = () => setIsMobile(mobileQuery.matches);
    update();
    mobileQuery.addEventListener("change", update);
    return () => mobileQuery.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!isMobile) return;

    document.documentElement.classList.add("mobile-play-mode");
    let frameId = 0;
    let lastHeight = 0;
    let lastWidth = 0;

    /** Viewport visual real: evita recortes por barras de Safari/Chromium. */
    const syncViewport = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const viewport = window.visualViewport;
        const height = Math.round(viewport?.height ?? window.innerHeight);
        const width = Math.round(viewport?.width ?? window.innerWidth);

        if (height !== lastHeight) {
          document.documentElement.style.setProperty("--app-height", `${height}px`);
          lastHeight = height;
        }
        if (width !== lastWidth) {
          document.documentElement.style.setProperty("--app-width", `${width}px`);
          lastWidth = width;
        }
      });
    };
    syncViewport();

    const vv = window.visualViewport;
    vv?.addEventListener("resize", syncViewport);
    window.addEventListener("resize", syncViewport);
    window.addEventListener("orientationchange", syncViewport);

    return () => {
      window.cancelAnimationFrame(frameId);
      document.documentElement.classList.remove("mobile-play-mode");
      document.documentElement.style.removeProperty("--app-height");
      document.documentElement.style.removeProperty("--app-width");
      vv?.removeEventListener("resize", syncViewport);
      window.removeEventListener("resize", syncViewport);
      window.removeEventListener("orientationchange", syncViewport);
    };
  }, [isMobile]);

  return { isMobile };
}
