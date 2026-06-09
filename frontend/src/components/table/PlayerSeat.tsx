"use client";

import { CardHand } from "@/components/cards/CardHand";
import { ChipDisplay } from "@/components/ui/ChipDisplay";
import type { Card as CardType } from "@cg/backend/types";

interface PlayerSeatProps {
  name: string;
  chips: number;
  cards: CardType[];
  bet?: number;
  isMe?: boolean;
  isActive?: boolean;
  isFolded?: boolean;
  subtitle?: string;
  badge?: string;
  footer?: React.ReactNode;
}

export function PlayerSeat({
  name,
  chips,
  cards,
  bet,
  isMe,
  isActive,
  isFolded,
  subtitle,
  badge,
  footer,
}: PlayerSeatProps) {
  return (
    <div
      className={`player-seat ${isMe ? "is-me" : ""} ${isActive ? "is-active animate-turn-ring" : ""} ${isFolded ? "is-folded" : ""}`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="player-avatar">{name[0]?.toUpperCase() ?? "?"}</div>
          <div>
            <p className="font-medium leading-tight">
              {name}
              {isMe && <span className="ml-1 text-[10px] text-casino-gold">TÚ</span>}
            </p>
            {subtitle && <p className="text-[11px] text-white/40">{subtitle}</p>}
            <p className="text-xs text-casino-gold">${chips}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {bet != null && bet > 0 && <ChipDisplay amount={bet} label="Apuesta" />}
          {badge && (
            <span className="rounded-full bg-casino-gold/20 px-2 py-0.5 text-[10px] text-casino-gold">
              {badge}
            </span>
          )}
        </div>
      </div>
      <CardHand cards={cards} size="sm" fromDealer={false} />
      {footer && <div className="mt-2">{footer}</div>}
    </div>
  );
}
