"use client";

import { useEffect, useRef, useState } from "react";

export type BetAnimMode = "fly" | "add";

export interface BetAnimState {
  mode: BetAnimMode;
  delta: number;
  previousAmount: number;
}

/** Detecta cuando cualquier jugador aumenta su apuesta y dispara animación. */
export function useBetAnimations(
  bets: Record<string, number>,
  durationMs = 1100
): Record<string, BetAnimState | undefined> {
  const prevRef = useRef<Record<string, number>>({});
  const [active, setActive] = useState<Record<string, BetAnimState>>({});
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      prevRef.current = { ...bets };
      return;
    }

    const next: Record<string, BetAnimState> = {};
    const merged = { ...prevRef.current, ...bets };

    for (const id of Object.keys(merged)) {
      const curr = bets[id] ?? 0;
      const prev = prevRef.current[id] ?? 0;
      if (curr > prev && curr > 0) {
        next[id] = {
          mode: prev === 0 ? "fly" : "add",
          delta: curr - prev,
          previousAmount: prev,
        };
      }
      prevRef.current[id] = curr;
    }

    if (Object.keys(next).length === 0) return;

    setActive(next);
    const t = setTimeout(() => setActive({}), durationMs);
    return () => clearTimeout(t);
  }, [bets, durationMs]);

  return active;
}
