"use client";

import type { Card as CardType } from "@cg/backend/types";
import { CardHand } from "@/components/cards/CardHand";

interface DealerAreaProps {
  cards: CardType[];
  total?: number | null;
  message?: string;
  showTotal?: boolean;
}

export function DealerArea({
  cards,
  total,
  message,
  showTotal = false,
}: DealerAreaProps) {
  return (
    <div className="dealer-area">
      <div className="dealer-badge">
        <div className="dealer-avatar">🎰</div>
        <div>
          <p className="dealer-title">Crupier CPU</p>
          <p className="dealer-sub">{message ?? "Listo para repartir"}</p>
        </div>
      </div>
      <CardHand cards={cards} size="md" fromDealer />
      {showTotal && total != null && (
        <p className="hand-total">
          Total crupier: <strong>{total}</strong>
        </p>
      )}
    </div>
  );
}
