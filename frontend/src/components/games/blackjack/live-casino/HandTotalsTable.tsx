"use client";

import type { Card } from "@cg/backend/types";
import { handTotal } from "@/lib/game-logic/deck";

export type HandTotalRow = {
  id: string;
  label: string;
  cards: Card[];
  total?: number | null;
  status?: string;
  isMe?: boolean;
  isDealer?: boolean;
  isActive?: boolean;
};

function formatTotal(cards: Card[], override?: number | null): string {
  if (override !== undefined && override !== null) return String(override);
  if (!cards.length) return "—";
  if (cards.every((c) => c.hidden)) return "?";
  const value = handTotal(cards);
  if (cards.some((c) => c.hidden)) return `${value}+`;
  return String(value);
}

/** Tabla compacta de totales (crupier + jugadores) — pensada para móvil. */
export function HandTotalsTable({ rows }: { rows: HandTotalRow[] }) {
  const visible = rows.filter((r) => r.cards.length > 0);
  if (visible.length === 0) return null;

  return (
    <div className="live-hand-totals" role="table" aria-label="Totales en mesa">
      <div className="live-hand-totals__head" role="row">
        <span role="columnheader">Jugador</span>
        <span role="columnheader">Total</span>
        <span role="columnheader">Estado</span>
      </div>
      {visible.map((row) => (
        <div
          key={row.id}
          role="row"
          className={`live-hand-totals__row${row.isMe ? " live-hand-totals__row--me" : ""}${
            row.isDealer ? " live-hand-totals__row--dealer" : ""
          }${row.isActive ? " live-hand-totals__row--active" : ""}`}
        >
          <span role="cell" className="live-hand-totals__name">
            {row.label}
          </span>
          <span role="cell" className="live-hand-totals__total">
            {formatTotal(row.cards, row.total)}
          </span>
          <span role="cell" className="live-hand-totals__status">
            {row.status || "—"}
          </span>
        </div>
      ))}
    </div>
  );
}
