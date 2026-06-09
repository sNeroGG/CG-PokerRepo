"use client";

import type { Card as CardType } from "@cg/backend/types";
import { PlayingCard } from "./PlayingCard";
import { dealDelay, type CardSize } from "@/lib/game-logic/animations";

interface CardHandProps {
  cards: CardType[];
  size?: CardSize;
  overlap?: boolean;
  className?: string;
  fromDealer?: boolean;
}

export function CardHand({
  cards,
  size = "md",
  overlap = true,
  className = "",
  fromDealer = true,
}: CardHandProps) {
  if (cards.length === 0) {
    return (
      <div
        className={`flex h-[96px] items-center justify-center text-xs text-white/25 ${className}`}
      >
        —
      </div>
    );
  }

  return (
    <div
      className={`card-hand ${overlap ? "card-hand-overlap" : ""} ${className}`}
    >
      {cards.map((card, i) => (
        <div
          key={`${card.rank}-${card.suit}-${i}-${card.hidden}`}
          className={overlap ? "card-hand-item" : ""}
          style={{ zIndex: i }}
        >
          <PlayingCard
            card={card}
            size={size}
            delay={fromDealer ? dealDelay(i) : i * 60}
            animate={fromDealer ? "deal-from-dealer" : "deal"}
          />
        </div>
      ))}
    </div>
  );
}

export { CardBack, CardSlot, PlayingCard } from "./PlayingCard";
