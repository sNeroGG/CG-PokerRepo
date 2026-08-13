import type { Card } from "@cg/backend/types";

export const DEALER_REVEAL_START_DELAY_MS = 1000;
export const DEALER_HOLE_FLIP_DURATION_MS = 1600;
export const DEALER_REVEAL_SETTLE_MS = 1000;
export const DEALER_DRAW_INTERVAL_MS = 1100;

/** Cartas visibles según fase de animación del crupier */
export function dealerCardsForPhase(fullHand: Card[], phase: number): Card[] {
  if (phase < 0 || fullHand.length === 0) return fullHand;

  if (fullHand.length === 1) {
    return fullHand.map((c) => ({ ...c, hidden: false }));
  }

  if (phase === 0) {
    return [
      { ...fullHand[0], hidden: false },
      { ...fullHand[1], hidden: true },
    ];
  }

  const count = Math.min(phase + 1, fullHand.length);
  return fullHand.slice(0, count).map((c) => ({ ...c, hidden: false }));
}

export type DealerRevealStage = "idle" | "pause" | "flip" | "settle" | "draw" | "done";

export function dealerRevealDurationMs(handLen: number): number {
  if (handLen <= 0) return 0;
  if (handLen === 1) return DEALER_HOLE_FLIP_DURATION_MS * 0.5;
  return (
    DEALER_REVEAL_START_DELAY_MS +
    DEALER_HOLE_FLIP_DURATION_MS +
    DEALER_REVEAL_SETTLE_MS +
    Math.max(0, handLen - 2) * DEALER_DRAW_INTERVAL_MS
  );
}

/** Instantes donde cambia la etapa; CSS interpola el giro sin rerenders por frame. */
export function dealerRevealBoundariesMs(handLen: number): number[] {
  if (handLen <= 0) return [];
  if (handLen === 1) return [dealerRevealDurationMs(1)];

  const afterPause = DEALER_REVEAL_START_DELAY_MS;
  const afterFlip = afterPause + DEALER_HOLE_FLIP_DURATION_MS;
  const afterSettle = afterFlip + DEALER_REVEAL_SETTLE_MS;
  const boundaries = [afterPause, afterFlip, afterSettle];

  for (let index = 1; index <= Math.max(0, handLen - 2); index += 1) {
    boundaries.push(afterSettle + index * DEALER_DRAW_INTERVAL_MS);
  }
  return boundaries;
}

/** Progreso del reveal según elapsed desde dealerRevealAt (reloj servidor). */
export function computeRevealState(
  elapsed: number,
  handLen: number
): {
  phase: number;
  complete: boolean;
  flipHole: boolean;
  animatingCardIndex: number | null;
  stage: DealerRevealStage;
  visibleCount: number;
} {
  if (handLen <= 0) {
    return {
      phase: -1,
      complete: true,
      flipHole: false,
      animatingCardIndex: null,
      stage: "done",
      visibleCount: 0,
    };
  }

  if (handLen === 1) {
    const done = elapsed >= DEALER_HOLE_FLIP_DURATION_MS * 0.5;
    return {
      phase: 0,
      complete: done,
      flipHole: false,
      animatingCardIndex: done ? null : 0,
      stage: done ? "done" : "draw",
      visibleCount: done ? 1 : 0,
    };
  }

  if (elapsed < DEALER_REVEAL_START_DELAY_MS) {
    return {
      phase: 0,
      complete: false,
      flipHole: false,
      animatingCardIndex: null,
      stage: "pause",
      visibleCount: 1,
    };
  }

  const afterStart = elapsed - DEALER_REVEAL_START_DELAY_MS;

  if (afterStart < DEALER_HOLE_FLIP_DURATION_MS) {
    return {
      phase: 0,
      complete: false,
      flipHole: true,
      animatingCardIndex: 1,
      stage: "flip",
      visibleCount: 1,
    };
  }

  const afterFlip = afterStart - DEALER_HOLE_FLIP_DURATION_MS;

  if (afterFlip < DEALER_REVEAL_SETTLE_MS) {
    return {
      phase: 1,
      complete: false,
      flipHole: false,
      animatingCardIndex: null,
      stage: "settle",
      visibleCount: 2,
    };
  }

  const afterSettle = afterFlip - DEALER_REVEAL_SETTLE_MS;

  if (handLen === 2) {
    return {
      phase: 1,
      complete: true,
      flipHole: false,
      animatingCardIndex: null,
      stage: "done",
      visibleCount: 2,
    };
  }

  const extraCards = handLen - 2;
  const drawIndex = Math.floor(afterSettle / DEALER_DRAW_INTERVAL_MS);

  if (drawIndex >= extraCards) {
    return {
      phase: handLen - 1,
      complete: true,
      flipHole: false,
      animatingCardIndex: null,
      stage: "done",
      visibleCount: handLen,
    };
  }

  const cardIndex = drawIndex + 2;

  return {
    phase: cardIndex,
    complete: false,
    flipHole: false,
    animatingCardIndex: cardIndex,
    stage: "draw",
    visibleCount: cardIndex,
  };
}
