"use client";

import type { Card } from "@cg/backend/types";
import { handTotal } from "@/lib/game-logic/deck";
import { TableCard } from "./TableCard";
import "./immersive-table.css";

export interface HandOverviewEntry {
  id: string;
  label: string;
  cards: Card[];
  total?: number | null;
  isMe?: boolean;
  isDealer?: boolean;
  isActive?: boolean;
}

export function HandsOverviewPanel({ entries }: { entries: HandOverviewEntry[] }) {
  const visible = entries.filter((e) => e.cards.length > 0);
  if (visible.length === 0) return null;

  return (
    <aside className="hands-overview-panel" aria-label="Resumen de cartas en mesa">
      {visible.map((entry) => {
        const total =
          entry.total ??
          (entry.cards.some((c) => !c.hidden) ? handTotal(entry.cards) : null);

        return (
          <div
            key={entry.id}
            className={`hands-overview-panel__entry ${entry.isMe ? "hands-overview-panel__entry--me" : ""} ${entry.isDealer ? "hands-overview-panel__entry--dealer" : ""} ${entry.isActive ? "hands-overview-panel__entry--active" : ""}`}
          >
            <span className="hands-overview-panel__label">{entry.label}</span>
            <div className="hands-overview-panel__cards">
              {entry.cards.map((card, i) => (
                <TableCard
                  key={`${entry.id}-${i}-${card.rank}-${card.suit}-${card.hidden}`}
                  card={card}
                  index={i}
                  size="sm"
                  variant={entry.isDealer ? "dealer" : "default"}
                  motion="none"
                  animate={false}
                />
              ))}
            </div>
            {total !== null && entry.cards.some((c) => !c.hidden) && (
              <span className="hands-overview-panel__total">{total}</span>
            )}
          </div>
        );
      })}
    </aside>
  );
}
