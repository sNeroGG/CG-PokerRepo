import type { Card } from "@cg/backend/types";

/** Intervalo entre cada carta (ms) — debe ser >= duración de animación */
export const CARD_DEAL_INTERVAL_MS = 850;
export const CARD_DEAL_ANIMATION_MS = 800;

export interface DealEvent {
  slot: string;
  cardIdx: number;
  globalIndex: number;
}

export function playerSlot(playerId: string, handIndex = 0): string {
  return `p:${playerId}:${handIndex}`;
}

export const DEALER_SLOT = "dealer";
export const COMMUNITY_SLOT = "community";

/** Blackjack inicial: P↑, D↑, P↑, D↓ por jugador */
export function buildBlackjackInitialPlan(playerIds: string[]): DealEvent[] {
  const events: DealEvent[] = [];
  let g = 0;

  for (const id of playerIds) {
    events.push({ slot: playerSlot(id, 0), cardIdx: 0, globalIndex: g++ });
  }
  events.push({ slot: DEALER_SLOT, cardIdx: 0, globalIndex: g++ });

  for (const id of playerIds) {
    events.push({ slot: playerSlot(id, 0), cardIdx: 1, globalIndex: g++ });
  }
  events.push({ slot: DEALER_SLOT, cardIdx: 1, globalIndex: g++ });

  return events;
}

/** Poker hole: una carta por jugador, luego segunda ronda */
export function buildPokerHolePlan(playerIds: string[]): DealEvent[] {
  const events: DealEvent[] = [];
  let g = 0;

  for (const id of playerIds) {
    events.push({ slot: playerSlot(id, 0), cardIdx: 0, globalIndex: g++ });
  }
  for (const id of playerIds) {
    events.push({ slot: playerSlot(id, 0), cardIdx: 1, globalIndex: g++ });
  }

  return events;
}

/** Cartas comunitarias (flop/turn/river) */
export function buildCommunityPlan(startIdx: number, count: number): DealEvent[] {
  return Array.from({ length: count }, (_, i) => ({
    slot: COMMUNITY_SLOT,
    cardIdx: startIdx + i,
    globalIndex: i,
  }));
}

/** Cartas extra en una mano (hit, double, split) */
export function buildDrawPlan(slot: string, startCardIdx: number, count: number): DealEvent[] {
  return Array.from({ length: count }, (_, i) => ({
    slot,
    cardIdx: startCardIdx + i,
    globalIndex: i,
  }));
}

/** Plan desde slots del servidor (hit, split, etc.) */
export function buildSlotsPlan(
  slots: string[],
  getLastCardIndex: (slot: string) => number
): DealEvent[] {
  return slots.map((slot, globalIndex) => ({
    slot,
    cardIdx: getLastCardIndex(slot),
    globalIndex,
  }));
}

export function buildBlackjackDealPlan(
  state: {
    dealStartedAt?: number;
    dealCardCount?: number;
    dealSlots?: string[];
    players: Array<{ playerId: string; hands: Array<{ cards: unknown[] }> }>;
    dealerHand: unknown[];
  },
  orderedPlayerIds: string[]
): DealEvent[] | null {
  if (!state.dealStartedAt || !state.dealCardCount) return null;

  const handIds = state.players.map((p) => p.playerId);
  const idsForPlan =
    handIds.length > 0
      ? handIds.filter((id) => orderedPlayerIds.includes(id)).length === handIds.length
        ? orderedPlayerIds.filter((id) => handIds.includes(id))
        : handIds
      : orderedPlayerIds;

  const initialCount = idsForPlan.length * 2 + 2;
  if (state.dealCardCount === initialCount) {
    return buildBlackjackInitialPlan(idsForPlan);
  }

  if (state.dealSlots?.length) {
    return buildSlotsPlan(state.dealSlots, (slot) => {
      if (slot === DEALER_SLOT) return state.dealerHand.length - 1;
      const m = slot.match(/^p:([^:]+):(\d+)$/);
      if (!m) return 0;
      const ps = state.players.find((p) => p.playerId === m[1]);
      const hand = ps?.hands[Number(m[2])];
      return Math.max(0, (hand?.cards.length ?? 1) - 1);
    });
  }

  return null;
}

export function buildPokerDealPlan(
  state: {
    dealStartedAt?: number;
    dealCardCount?: number;
    dealSlots?: string[];
    phase: string;
    communityCards: unknown[];
    players: Array<{ playerId: string; holeCards: unknown[] }>;
  },
  orderedPlayerIds: string[]
): DealEvent[] | null {
  if (!state.dealStartedAt || !state.dealCardCount) return null;

  const handIds = state.players.map((p) => p.playerId);
  const idsForPlan =
    handIds.length > 0
      ? handIds.filter((id) => orderedPlayerIds.includes(id)).length === handIds.length
        ? orderedPlayerIds.filter((id) => handIds.includes(id))
        : handIds
      : orderedPlayerIds;

  if (state.phase === "preflop" && state.dealCardCount === idsForPlan.length * 2) {
    return buildPokerHolePlan(idsForPlan);
  }

  if (state.dealSlots?.includes(COMMUNITY_SLOT)) {
    const startIdx = state.communityCards.length - state.dealCardCount;
    return buildCommunityPlan(startIdx, state.dealCardCount);
  }

  return null;
}

export function visibleCountForSlot(
  slot: string,
  plan: DealEvent[],
  visibleGlobal: number,
  totalCards: number
): number {
  const slotEvents = plan.filter((e) => e.slot === slot);
  if (slotEvents.length === 0) return totalCards;

  const revealedCount = slotEvents.filter((e) => e.globalIndex < visibleGlobal).length;
  const baseCount = totalCards - slotEvents.length;
  return Math.min(totalCards, Math.max(0, baseCount + revealedCount));
}

export function animatingCardIndex(
  slot: string,
  plan: DealEvent[],
  visibleGlobal: number
): number | null {
  const justRevealed = plan.find((e) => e.slot === slot && e.globalIndex === visibleGlobal - 1);
  return justRevealed?.cardIdx ?? null;
}

export function resolveDealPlan(
  plan: DealEvent[] | null,
  cards: Card[],
  slot: string,
  visibleGlobal: number,
  complete: boolean
): { visibleCards: Card[]; motionIndex: number | null } {
  if (complete || !plan?.length) {
    return { visibleCards: cards, motionIndex: null };
  }

  const count = visibleCountForSlot(slot, plan, visibleGlobal, cards.length);
  const motionIndex = animatingCardIndex(slot, plan, visibleGlobal);

  return {
    visibleCards: cards.slice(0, count),
    motionIndex,
  };
}
