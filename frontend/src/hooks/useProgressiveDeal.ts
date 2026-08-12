"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CARD_DEAL_INTERVAL_MS,
  type DealEvent,
} from "@/lib/table/deal-sequence";
import { computeProgressiveDeal } from "@/lib/table/progressive-deal";

export { CARD_DEAL_INTERVAL_MS };

/** Reordena IDs de mano con el viewer primero (posición 0). */
export function reorderHandPlayerIds(playerIds: string[], viewerId: string): string[] {
  const myIdx = playerIds.indexOf(viewerId);
  if (myIdx <= 0) return playerIds;
  return [...playerIds.slice(myIdx), ...playerIds.slice(0, myIdx)];
}

export function useProgressiveDeal(
  dealStartedAt?: number,
  dealCardCount?: number
) {
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    if (!dealStartedAt || !dealCardCount) return;
    setTick(Date.now());
    const id = setInterval(() => setTick(Date.now()), 40);
    return () => clearInterval(id);
  }, [dealStartedAt, dealCardCount]);

  return useMemo(
    () => computeProgressiveDeal(dealStartedAt, dealCardCount, tick),
    [dealStartedAt, dealCardCount, tick]
  );
}

export function useDealPlanContext(
  dealStartedAt: number | undefined,
  dealCardCount: number | undefined,
  plan: DealEvent[] | null
) {
  const { visibleGlobal, complete, isDealing } = useProgressiveDeal(
    dealStartedAt,
    dealCardCount
  );

  return {
    visibleGlobal,
    complete,
    isDealing,
    plan: complete ? null : plan,
  };
}
