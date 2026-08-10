"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CARD_DEAL_INTERVAL_MS,
  type DealEvent,
} from "@/lib/table/deal-sequence";

export { CARD_DEAL_INTERVAL_MS };

export function useProgressiveDeal(
  dealStartedAt?: number,
  dealCardCount?: number
) {
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    if (!dealStartedAt || !dealCardCount) return;
    setTick(Date.now());
    const id = setInterval(() => setTick(Date.now()), 45);
    return () => clearInterval(id);
  }, [dealStartedAt, dealCardCount]);

  return useMemo(() => {
    if (!dealStartedAt || !dealCardCount) {
      return {
        visibleGlobal: dealCardCount ?? Number.MAX_SAFE_INTEGER,
        complete: true,
        isDealing: false,
      };
    }

    const elapsed = Math.max(0, tick - dealStartedAt);
    const visibleGlobal = Math.min(
      dealCardCount,
      Math.floor(elapsed / CARD_DEAL_INTERVAL_MS) + 1
    );
    const complete = visibleGlobal >= dealCardCount;

    return {
      visibleGlobal,
      complete,
      isDealing: !complete,
    };
  }, [dealStartedAt, dealCardCount, tick]);
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
