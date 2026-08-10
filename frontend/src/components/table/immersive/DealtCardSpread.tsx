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
}: {
  cards: Card[];
  slot: string;
  plan: DealEvent[] | null;
  visibleGlobal: number;
  complete: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "victory" | "dealer";
  keyPrefix?: string;
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
      {visibleCards.map((card, i) => (
        <TableCard
          key={`${keyPrefix}-${slot}-${i}-${card.rank}-${card.suit}-${card.hidden}`}
          card={card}
          index={0}
          size={size}
          variant={variant}
          motion={motionIndex === i ? "deal" : "none"}
          animate={motionIndex === i}
          className={motionIndex === i ? "live-table-card--dealing-now" : undefined}
        />
      ))}
    </>
  );
}
