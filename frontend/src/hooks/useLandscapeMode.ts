"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "cg-landscape-mode";

export function useLandscapeMode() {
  const [enabled, setEnabled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved === "1") setEnabled(true);

    const check = () => setIsMobile(window.innerWidth <= 900);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("mobile-play-mode", enabled);
    sessionStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
    return () => document.documentElement.classList.remove("mobile-play-mode");
  }, [enabled]);

  const toggle = useCallback(async () => {
    const next = !enabled;
    setEnabled(next);

    if (next && typeof screen !== "undefined") {
      try {
        const orientation = screen.orientation as ScreenOrientation & {
          lock?: (mode: string) => Promise<void>;
        };
        if (orientation?.lock) {
          await orientation.lock("landscape").catch(() => {});
        }
      } catch {
        /* CSS fallback handles rotation */
      }
    } else {
      try {
        const orientation = screen.orientation as ScreenOrientation & {
          unlock?: () => void;
        };
        orientation?.unlock?.();
      } catch {
        /* ignore */
      }
    }
  }, [enabled]);

  return { enabled, toggle, isMobile };
}
