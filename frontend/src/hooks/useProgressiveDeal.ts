"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CARD_DEAL_INTERVAL_MS,
  type DealEvent,
} from "@/lib/table/deal-sequence";

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
  const lastBatchRef = useRef("");
  const [localStart, setLocalStart] = useState<number | undefined>();

  const batchKey = `${dealStartedAt ?? ""}:${dealCardCount ?? ""}`;

  useEffect(() => {
    if (!dealStartedAt || !dealCardCount) {
      lastBatchRef.current = "";
      setLocalStart(undefined);
      return;
    }

    if (batchKey !== lastBatchRef.current) {
      lastBatchRef.current = batchKey;
      setLocalStart(Date.now());
    }
  }, [batchKey, dealStartedAt, dealCardCount]);

  useEffect(() => {
    if (!localStart || !dealCardCount) return;
    setTick(Date.now());
    const id = setInterval(() => setTick(Date.now()), 40);
    return () => clearInterval(id);
  }, [localStart, dealCardCount]);

  return useMemo(() => {
    if (!dealCardCount || !localStart) {
      return {
        visibleGlobal: dealCardCount ?? Number.MAX_SAFE_INTEGER,
        complete: true,
        isDealing: false,
      };
    }

    const elapsed = Math.max(0, tick - localStart);
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
  }, [localStart, dealCardCount, tick]);
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
