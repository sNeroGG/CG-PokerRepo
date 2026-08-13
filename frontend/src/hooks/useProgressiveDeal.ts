"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CARD_DEAL_INTERVAL_MS,
  type DealEvent,
} from "@/lib/table/deal-sequence";
import {
  computeProgressiveDeal,
  resolvePresentationStart,
  resolveUpdatedBatchStart,
} from "@/lib/table/progressive-deal";

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
  const batchKey = `${dealStartedAt ?? ""}:${dealCardCount ?? ""}`;
  const [tick, setTick] = useState(() => Date.now());
  const [trackedBatch, setTrackedBatch] = useState(batchKey);
  const [presentationStart, setPresentationStart] = useState<number | undefined>(() => {
    if (!dealStartedAt || !dealCardCount) return undefined;
    return resolvePresentationStart(dealStartedAt, dealCardCount, Date.now());
  });

  // Sincroniza el ancla en el mismo render (evita 1 frame “complete” sin animación)
  if (batchKey !== trackedBatch) {
    setTrackedBatch(batchKey);
    if (!dealStartedAt || !dealCardCount) {
      setPresentationStart(undefined);
    } else {
      setPresentationStart(resolveUpdatedBatchStart(dealStartedAt, dealCardCount, Date.now()));
    }
  }

  useEffect(() => {
    if (!presentationStart || !dealCardCount) return;
    setTick(Date.now());
    const id = setInterval(() => setTick(Date.now()), 40);
    return () => clearInterval(id);
  }, [presentationStart, dealCardCount, batchKey]);

  return useMemo(
    () => computeProgressiveDeal(presentationStart, dealCardCount, tick),
    [presentationStart, dealCardCount, tick]
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
