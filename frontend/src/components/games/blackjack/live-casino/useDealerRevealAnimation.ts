"use client";

import { useEffect, useState } from "react";
import type { BlackjackState, Card } from "@cg/backend/types";
import { handTotal } from "@/lib/game-logic/deck";

const START_DELAY_MS = 400;
const FLIP_DELAY_MS = 550;
const DRAW_DELAY_MS = 750;

function handSignature(hand: Card[]) {
  return hand.map((c) => `${c.rank}${c.suit}`).join("|");
}

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

function computeRevealState(
  elapsed: number,
  handLen: number
): {
  phase: number;
  complete: boolean;
  flipHole: boolean;
  animatingCardIndex: number | null;
} {
  if (handLen <= 0) {
    return { phase: -1, complete: true, flipHole: false, animatingCardIndex: null };
  }

  if (handLen === 1) {
    return elapsed >= 300
      ? { phase: 0, complete: true, flipHole: false, animatingCardIndex: null }
      : { phase: 0, complete: false, flipHole: false, animatingCardIndex: null };
  }

  if (elapsed < START_DELAY_MS) {
    return { phase: 0, complete: false, flipHole: false, animatingCardIndex: null };
  }

  const afterStart = elapsed - START_DELAY_MS;

  if (afterStart < FLIP_DELAY_MS) {
    return { phase: 0, complete: false, flipHole: true, animatingCardIndex: 1 };
  }

  const afterFlip = afterStart - FLIP_DELAY_MS;

  if (handLen === 2) {
    return { phase: 1, complete: true, flipHole: false, animatingCardIndex: null };
  }

  const extraCards = handLen - 2;
  const drawIndex = Math.floor(afterFlip / DRAW_DELAY_MS);

  if (drawIndex >= extraCards) {
    return {
      phase: handLen - 1,
      complete: true,
      flipHole: false,
      animatingCardIndex: null,
    };
  }

  return {
    phase: drawIndex + 1,
    complete: false,
    flipHole: false,
    animatingCardIndex: drawIndex + 2,
  };
}

export function useDealerRevealAnimation(state: BlackjackState) {
  const isRoundEnd = state.phase === "roundEnd";
  const handLen = state.dealerHand.length;
  const signature = handSignature(state.dealerHand);
  const fullHand = state.dealerHand.map((c) => ({ ...c, hidden: false }));
  const needsAnimation = isRoundEnd && handLen >= 1;
  const revealAt = state.dealerRevealAt;

  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!needsAnimation || !revealAt) return;
    const id = setInterval(() => setTick(Date.now()), 50);
    return () => clearInterval(id);
  }, [needsAnimation, revealAt, signature]);

  if (!needsAnimation) {
    return {
      displayedHand: state.dealerHand,
      displayedTotal: handTotal(state.dealerHand.map((c) => ({ ...c, hidden: false }))),
      isAnimating: false,
      animatingCardIndex: null as number | null,
      flipHole: false,
      complete: true,
    };
  }

  const elapsed = revealAt ? Math.max(0, (tick || Date.now()) - revealAt) : 0;
  const { phase, complete, flipHole, animatingCardIndex } = revealAt
    ? computeRevealState(elapsed, handLen)
    : { phase: -1, complete: false, flipHole: false, animatingCardIndex: null };

  const displayedHand =
    !complete && revealAt ? dealerCardsForPhase(fullHand, phase) : state.dealerHand;

  const displayedTotal = handTotal(
    !complete && revealAt
      ? displayedHand
      : state.dealerHand.map((c) => ({ ...c, hidden: false }))
  );

  return {
    displayedHand,
    displayedTotal,
    isAnimating: needsAnimation && !complete,
    animatingCardIndex,
    flipHole: flipHole && phase === 0,
    complete: !needsAnimation || complete || !revealAt,
  };
}
