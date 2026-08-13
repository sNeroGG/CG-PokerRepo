"use client";

import { useEffect } from "react";

const IDLE_TIMEOUT_MS = 2_000;

export function PwaRegistration() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    let idleId: number | undefined;
    let timeoutId: number | undefined;
    let cancelled = false;

    const register = () => {
      if (cancelled) return;
      void navigator.serviceWorker.register("/sw.js", { scope: "/" });
    };

    const schedule = () => {
      if ("requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(register, {
          timeout: IDLE_TIMEOUT_MS,
        });
      } else {
        timeoutId = window.setTimeout(register, IDLE_TIMEOUT_MS);
      }
    };

    if (document.readyState === "complete") {
      schedule();
    } else {
      window.addEventListener("load", schedule, { once: true });
    }

    return () => {
      cancelled = true;
      window.removeEventListener("load", schedule);
      if (idleId !== undefined && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, []);

  return null;
}
