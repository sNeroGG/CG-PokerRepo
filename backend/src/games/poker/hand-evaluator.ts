import type { Card, Rank } from "../../types";

const RANK_ORDER: Rank[] = [
  "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A",
];

function rankIndex(rank: Rank): number {
  return RANK_ORDER.indexOf(rank);
}

export interface EvaluatedHand {
  rank: number; // 0-8
  name: string;
  values: number[]; // tiebreaker
}

function getCombinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  const withFirst = getCombinations(rest, k - 1).map((c) => [first, ...c]);
  const withoutFirst = getCombinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

function evaluateFive(cards: Card[]): EvaluatedHand {
  const ranks = cards.map((c) => rankIndex(c.rank)).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);
  const isFlush = suits.every((s) => s === suits[0]);

  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  const groups = Array.from(counts.entries()).sort((a, b) =>
    b[1] !== a[1] ? b[1] - a[1] : b[0] - a[0]
  );

  const isStraight = (() => {
    const sorted = Array.from(new Set(ranks)).sort((a, b) => b - a);
    if (sorted.length < 5) return { ok: false, high: 0 };
    for (let i = 0; i <= sorted.length - 5; i++) {
      if (sorted[i] - sorted[i + 4] === 4) return { ok: true, high: sorted[i] };
    }
    if (sorted.includes(12) && sorted.includes(3) && sorted.includes(2) &&
        sorted.includes(1) && sorted.includes(0)) {
      return { ok: true, high: 3 };
    }
    return { ok: false, high: 0 };
  })();

  if (isFlush && isStraight.ok) {
    const name = ranks[0] === 12 && isStraight.high === 12
      ? "Escalera Real"
      : "Escalera de Color";
    return { rank: 8, name, values: [isStraight.high] };
  }

  if (groups[0][1] === 4) {
    return { rank: 7, name: "Póker", values: [groups[0][0], groups[1][0]] };
  }

  if (groups[0][1] === 3 && groups[1][1] === 2) {
    return { rank: 6, name: "Full House", values: [groups[0][0], groups[1][0]] };
  }

  if (isFlush) {
    return { rank: 5, name: "Color", values: ranks };
  }

  if (isStraight.ok) {
    return { rank: 4, name: "Escalera", values: [isStraight.high] };
  }

  if (groups[0][1] === 3) {
    const kickers = groups.slice(1).map((g) => g[0]).sort((a, b) => b - a);
    return { rank: 3, name: "Trío", values: [groups[0][0], ...kickers] };
  }

  if (groups[0][1] === 2 && groups[1][1] === 2) {
    const high = Math.max(groups[0][0], groups[1][0]);
    const low = Math.min(groups[0][0], groups[1][0]);
    const kicker = groups[2]?.[0] ?? 0;
    return { rank: 2, name: "Doble Pareja", values: [high, low, kicker] };
  }

  if (groups[0][1] === 2) {
    const kickers = groups.slice(1).map((g) => g[0]).sort((a, b) => b - a);
    return { rank: 1, name: "Pareja", values: [groups[0][0], ...kickers] };
  }

  return { rank: 0, name: "Carta Alta", values: ranks };
}

export function evaluateHand(holeCards: Card[], community: Card[]): EvaluatedHand {
  const all = [...holeCards, ...community];
  if (all.length < 5) {
    return { rank: -1, name: "Incompleta", values: [] };
  }
  const combos = getCombinations(all, 5);
  let best: EvaluatedHand = { rank: -1, name: "", values: [] };
  for (const combo of combos) {
    const ev = evaluateFive(combo);
    if (ev.rank > best.rank || (ev.rank === best.rank && compareValues(ev.values, best.values) > 0)) {
      best = ev;
    }
  }
  return best;
}

function compareValues(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function compareHands(a: EvaluatedHand, b: EvaluatedHand): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  return compareValues(a.values, b.values);
}
