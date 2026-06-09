import type { Card, Rank, Suit } from "@cg/backend/types";

const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
const RANKS: Rank[] = [
  "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A",
];

export function createDeck(numDecks = 1): Card[] {
  const deck: Card[] = [];
  for (let d = 0; d < numDecks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ suit, rank });
      }
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function drawCards(
  deck: Card[],
  count: number
): { drawn: Card[]; remaining: Card[] } {
  return { drawn: deck.slice(0, count), remaining: deck.slice(count) };
}

export function cardValue(rank: Rank): number {
  if (rank === "A") return 11;
  if (["K", "Q", "J"].includes(rank)) return 10;
  return parseInt(rank, 10);
}

export function handTotal(cards: Card[]): number {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    if (card.hidden) continue;
    if (card.rank === "A") {
      aces++;
      total += 11;
    } else {
      total += cardValue(card.rank);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

export function handTotalAll(cards: Card[]): number {
  return handTotal(cards.map((c) => ({ ...c, hidden: false })));
}

export function visibleDealerTotal(cards: Card[]): { value: number; partial: boolean } | null {
  if (cards.length === 0) return null;
  const hasHidden = cards.some((c) => c.hidden);
  const value = handTotal(cards);
  return { value, partial: hasHidden };
}

export function isBlackjack(cards: Card[]): boolean {
  const visible = cards.filter((c) => !c.hidden);
  return visible.length === 2 && handTotal(visible) === 21;
}

export const SUIT_SYMBOL: Record<Suit, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

export const SUIT_COLOR: Record<Suit, string> = {
  hearts: "text-casino-red",
  diamonds: "text-casino-red",
  clubs: "text-gray-900",
  spades: "text-gray-900",
};

export function formatCard(card: Card): string {
  if (card.hidden) return "🂠";
  return `${card.rank}${SUIT_SYMBOL[card.suit]}`;
}

/** Valor para comparar pares en Split (10/J/Q/K = 10) */
export function splitValue(rank: Rank): number {
  if (["K", "Q", "J", "10"].includes(rank)) return 10;
  if (rank === "A") return 11;
  return parseInt(rank, 10);
}

export function canSplitCards(cards: Card[]): boolean {
  if (cards.length !== 2) return false;
  return splitValue(cards[0].rank) === splitValue(cards[1].rank);
}
