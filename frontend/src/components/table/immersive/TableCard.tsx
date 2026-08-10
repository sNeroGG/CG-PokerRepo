"use client";

import type { Card } from "@cg/backend/types";
import { SUIT_SYMBOL } from "@/lib/game-logic/deck";
import { isRedSuit } from "@/lib/game-logic/card-utils";
import { BRAND_NAME_SHORT } from "@/lib/brand";

export function TableCard({
  card,
  index = 0,
  size = "md",
  animate = true,
  variant = "default",
  motion = "deal",
  className = "",
}: {
  card: Card;
  index?: number;
  size?: "sm" | "md" | "lg";
  animate?: boolean;
  variant?: "default" | "victory" | "dealer";
  motion?: "deal" | "flip" | "draw" | "none";
  className?: string;
}) {
  const isHidden = card.hidden;
  const color = isHidden ? "" : isRedSuit(card.suit) ? "red" : "black";

  const motionClass =
    motion === "flip"
      ? "live-table-card--flip"
      : motion === "draw"
        ? "live-table-card--draw"
        : animate && motion !== "none"
          ? "live-table-card--deal"
          : "";

  return (
    <div
      className={`live-table-card live-table-card--${size} live-table-card--${variant} ${motionClass} ${isHidden ? "live-table-card--back" : `live-table-card--${color}`} ${className}`.trim()}
      style={{
        animationDelay:
          motion === "deal" && animate && index > 0 ? `${index * 0.18}s` : undefined,
        zIndex: index,
      }}
    >
      <div className="live-table-card-inner">
        {isHidden ? (
          <span className="live-table-card-logo">{BRAND_NAME_SHORT}</span>
        ) : (
          <>
            <span className="live-table-card-rank">{card.rank}</span>
            <span className="live-table-card-suit">{SUIT_SYMBOL[card.suit]}</span>
            <span className="live-table-card-rank live-table-card-rank--bl">{card.rank}</span>
          </>
        )}
      </div>
    </div>
  );
}
