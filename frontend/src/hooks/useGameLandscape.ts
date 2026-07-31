"use client";

import { useEffect, useState } from "react";

/** Fuerza vista horizontal en móvil al entrar al juego (sin opción vertical). */
export function useGameLandscape() {
  const [isMobile, setIsMobile] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    const update = () => {
      setIsMobile(window.innerWidth <= 900);
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
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

    document.documentElement.classList.add("landscape-play-mode");

    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (mode: string) => Promise<void>;
    };
    orientation?.lock?.("landscape").catch(() => {});

    return () => {
      document.documentElement.classList.remove("landscape-play-mode");
      try {
        orientation?.unlock?.();
      } catch {
        /* ignore */
      }
    };
  }, [isMobile]);

  return { isMobile, isPortrait };
}
