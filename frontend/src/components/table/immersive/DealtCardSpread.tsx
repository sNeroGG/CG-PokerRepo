"use client";

import type { Card } from "@cg/backend/types";
import { TableCard } from "./TableCard";
import { resolveDealPlan, type DealEvent } from "@/lib/table/deal-sequence";

export function DealtCardSpread({
  cards,
  slot,
  plan,
  visibleGlobal,
  complete,
  size = "md",
  variant = "default",
  keyPrefix = "card",
  dealBatchKey = "",
}: {
  cards: Card[];
  slot: string;
  plan: DealEvent[] | null;
  visibleGlobal: number;
  complete: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "victory" | "dealer";
  keyPrefix?: string;
  /** Fuerza remount CSS al cambiar de batch (hit/double) */
  dealBatchKey?: string;
}) {
  const { visibleCards, motionIndex } = resolveDealPlan(
    plan,
    cards,
    slot,
    visibleGlobal,
    complete
  );

  return (
    <>
      {visibleCards.map((card, i) => {
        const isAnimatingNow = motionIndex === i;
        return (
          <TableCard
            key={`${keyPrefix}-${slot}-${dealBatchKey}-${i}-${card.rank}-${card.suit}-${isAnimatingNow ? "anim" : "set"}`}
            card={card}
            index={i}
            size={size}
            variant={variant}
            motion={isAnimatingNow ? "draw" : "none"}
            animate={isAnimatingNow}
            className={isAnimatingNow ? "live-table-card--dealing-now" : undefined}
          />
        );
      })}
    </>
  );
}
