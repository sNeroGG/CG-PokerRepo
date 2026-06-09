import type { Card, Rank, Suit } from "@cg/backend/types";
import { SUIT_SYMBOL, handTotal } from "./deck";

export function isRedSuit(suit: Suit): boolean {
  return suit === "hearts" || suit === "diamonds";
}

const RANK_NAMES: Partial<Record<Rank, string>> = {
  A: "As",
  K: "Rey",
  Q: "Reina",
  J: "Jota",
};

export function getCardDisplayName(card: Card): string {
  if (card.hidden) return "Carta oculta";
  const rank = RANK_NAMES[card.rank] ?? card.rank;
  const suitNames: Record<Suit, string> = {
    hearts: "Corazones",
    diamonds: "Diamantes",
    clubs: "Tréboles",
    spades: "Picas",
  };
  return `${rank} de ${suitNames[card.suit]}`;
}

export function getHandDescription(cards: Card[]): string {
  const visible = cards.filter((c) => !c.hidden);
  if (visible.length === 0) return "Sin cartas";
  const total = handTotal(cards);
  const symbols = visible.map((c) => `${c.rank}${SUIT_SYMBOL[c.suit]}`).join(" ");
  if (total > 21) return `${symbols} — Se pasó (${total})`;
  return `${symbols} — Total ${total}`;
}

export function compareVisibleTotals(a: Card[], b: Card[]): number {
  return handTotal(a) - handTotal(b);
}
