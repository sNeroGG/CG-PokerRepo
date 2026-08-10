"use client";

import type { Card as CardType, Rank, Suit } from "@cg/backend/types";
import { CardBackBrandLogo } from "@/components/brand/CardBackBrandLogo";
import { SUIT_SYMBOL } from "@/lib/game-logic/deck";
import { isRedSuit } from "@/lib/game-logic/card-utils";
import type { CardSize } from "@/lib/game-logic/animations";

const SIZE_CLASS: Record<CardSize, string> = {
  sm: "h-[72px] w-[50px] text-[10px]",
  md: "h-[96px] w-[68px] text-xs",
  lg: "h-[120px] w-[84px] text-sm",
};

const CENTER_CLASS: Record<CardSize, string> = {
  sm: "text-2xl",
  md: "text-3xl",
  lg: "text-4xl",
};

export interface CardVisualProps {
  className?: string;
  delay?: number;
  size?: CardSize;
  animate?: "deal" | "deal-from-dealer" | "flip" | "none";
}

function faceLabel(rank: Rank): string | null {
  if (["J", "Q", "K", "A"].includes(rank)) return rank;
  return null;
}

export function CardBack({
  className = "",
  size = "md",
  delay = 0,
  animate = "deal-from-dealer",
}: CardVisualProps) {
  const anim =
    animate === "none"
      ? ""
      : animate === "flip"
        ? "animate-card-flip"
        : animate === "deal-from-dealer"
          ? "animate-deal-from-dealer"
          : "animate-deal-in";

  return (
    <div
      className={`playing-card card-back ${SIZE_CLASS[size]} ${anim} ${className}`}
      style={{ animationDelay: `${delay}ms`, perspective: "800px" }}
    >
      <div className="card-back-inner">
        <div className="card-back-pattern" />
        <CardBackBrandLogo />
      </div>
    </div>
  );
}

export function CardSlot({
  className = "",
  size = "md",
}: {
  className?: string;
  size?: CardSize;
}) {
  return (
    <div className={`card-slot ${SIZE_CLASS[size]} ${className}`} aria-hidden />
  );
}

export function PlayingCard({
  card,
  className = "",
  delay = 0,
  size = "md",
  animate = "deal-from-dealer",
}: CardVisualProps & { card: CardType }) {
  if (card.hidden) {
    return (
      <CardBack className={className} size={size} delay={delay} animate={animate} />
    );
  }

  const red = isRedSuit(card.suit);
  const symbol = SUIT_SYMBOL[card.suit];
  const face = faceLabel(card.rank);
  const anim =
    animate === "none"
      ? ""
      : animate === "flip"
        ? "animate-card-flip"
        : animate === "deal-from-dealer"
          ? "animate-deal-from-dealer"
          : "animate-deal-in";

  return (
    <div
      className={`playing-card card-face ${SIZE_CLASS[size]} ${anim} ${className}`}
      style={{ animationDelay: `${delay}ms` }}
      title={`${card.rank}${symbol}`}
    >
      <div className={`card-corner top-left ${red ? "suit-red" : "suit-black"}`}>
        <span className="card-rank">{card.rank}</span>
        <span className="card-suit-sm">{symbol}</span>
      </div>
      <div className={`card-center ${red ? "suit-red" : "suit-black"}`}>
        {face ? (
          <span className={`font-display font-bold ${CENTER_CLASS[size]}`}>{face}</span>
        ) : (
          <span className={CENTER_CLASS[size]}>{symbol}</span>
        )}
      </div>
      <div className={`card-corner bottom-right ${red ? "suit-red" : "suit-black"}`}>
        <span className="card-rank">{card.rank}</span>
        <span className="card-suit-sm">{symbol}</span>
      </div>
    </div>
  );
}
