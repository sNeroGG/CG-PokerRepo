"use client";

import { useEffect, useRef, useState } from "react";
import type { BlackjackState, Card } from "@cg/backend/types";
import { handTotal } from "@/lib/game-logic/deck";
import { CARD_DEAL_INTERVAL_MS } from "@/lib/table/deal-sequence";

const START_DELAY_MS = 550;
const FLIP_DURATION_MS = CARD_DEAL_INTERVAL_MS;
const DRAW_INTERVAL_MS = CARD_DEAL_INTERVAL_MS;

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

export type DealerRevealStage = "idle" | "pause" | "flip" | "draw" | "done";

function computeRevealState(
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
    const done = elapsed >= FLIP_DURATION_MS * 0.5;
    return {
      phase: 0,
      complete: done,
      flipHole: false,
      animatingCardIndex: done ? null : 0,
      stage: done ? "done" : "draw",
      visibleCount: done ? 1 : 0,
    };
  }

  if (elapsed < START_DELAY_MS) {
    return {
      phase: 0,
      complete: false,
      flipHole: false,
      animatingCardIndex: null,
      stage: "pause",
      visibleCount: 1,
    };
  }

  const afterStart = elapsed - START_DELAY_MS;

  if (afterStart < FLIP_DURATION_MS) {
    return {
      phase: 0,
      complete: false,
      flipHole: true,
      animatingCardIndex: 1,
      stage: "flip",
      visibleCount: 1,
    };
  }

  const afterFlip = afterStart - FLIP_DURATION_MS;

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
  const drawIndex = Math.floor(afterFlip / DRAW_INTERVAL_MS);

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

export function useDealerRevealAnimation(
  state: BlackjackState,
  options?: { enabled?: boolean }
) {
  const enabled = options?.enabled ?? true;
  const isRoundEnd = state.phase === "roundEnd";
  const handLen = state.dealerHand.length;
  const signature = handSignature(state.dealerHand);
  const fullHand = state.dealerHand.map((c) => ({ ...c, hidden: false }));
  const needsAnimation = enabled && isRoundEnd && handLen >= 1;
  const revealAt = state.dealerRevealAt;

  const anchorRef = useRef<number | null>(null);
  const lastSignatureRef = useRef("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!needsAnimation || !revealAt) {
      anchorRef.current = null;
      lastSignatureRef.current = "";
      return;
    }

    if (signature !== lastSignatureRef.current) {
      lastSignatureRef.current = signature;
      anchorRef.current = Date.now();
    }

    setTick(Date.now());
    const id = setInterval(() => setTick(Date.now()), 40);
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
      stage: "done" as DealerRevealStage,
      visibleCount: handLen,
      totalCount: handLen,
    };
  }

  const anchor = anchorRef.current ?? Date.now();
  const elapsed = Math.max(0, (tick || Date.now()) - anchor);
  const { phase, complete, flipHole, animatingCardIndex, stage, visibleCount } =
    computeRevealState(elapsed, handLen);

  const displayedHand = !complete ? dealerCardsForPhase(fullHand, phase) : state.dealerHand;

  const displayedTotal = handTotal(
    !complete ? displayedHand : state.dealerHand.map((c) => ({ ...c, hidden: false }))
  );

  return {
    displayedHand,
    displayedTotal,
    isAnimating: !complete,
    animatingCardIndex,
    flipHole: flipHole && phase === 0,
    complete,
    stage,
    visibleCount,
    totalCount: handLen,
  };
}
