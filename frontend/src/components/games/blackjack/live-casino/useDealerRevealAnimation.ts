"use client";

import { useEffect, useRef, useState } from "react";
import type { BlackjackState, Card } from "@cg/backend/types";
import { handTotal } from "@/lib/game-logic/deck";

const FLIP_DELAY_MS = 550;
const DRAW_DELAY_MS = 750;
const START_DELAY_MS = 400;

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

export function useDealerRevealAnimation(state: BlackjackState) {
  const isRoundEnd = state.phase === "roundEnd";
  const handLen = state.dealerHand.length;
  const signature = handSignature(state.dealerHand);
  const fullHand = state.dealerHand.map((c) => ({ ...c, hidden: false }));
  const needsAnimation = isRoundEnd && handLen >= 1;

  const [phase, setPhase] = useState(-1);
  const [complete, setComplete] = useState(false);
  const [animatingCardIndex, setAnimatingCardIndex] = useState<number | null>(null);
  const [flipHole, setFlipHole] = useState(false);
  const sigRef = useRef("");

  useEffect(() => {
    if (!needsAnimation) {
      setPhase(-1);
      setComplete(false);
      setAnimatingCardIndex(null);
      setFlipHole(false);
      sigRef.current = "";
      return;
    }

    if (signature === sigRef.current) return;

    sigRef.current = signature;
    setPhase(0);
    setComplete(false);
    setAnimatingCardIndex(null);
    setFlipHole(false);
  }, [needsAnimation, signature]);

  useEffect(() => {
    if (!needsAnimation || phase < 0 || complete) return;

    const maxPhase = Math.max(0, fullHand.length - 1);

    if (phase === 0 && fullHand.length === 1) {
      const t = setTimeout(() => setComplete(true), 300);
      return () => clearTimeout(t);
    }

    if (phase === 0) {
      const t = setTimeout(() => {
        setFlipHole(true);
        setAnimatingCardIndex(1);
        setPhase(1);
      }, START_DELAY_MS);
      return () => clearTimeout(t);
    }

    if (phase === 1 && fullHand.length === 2) {
      const t = setTimeout(() => {
        setAnimatingCardIndex(null);
        setFlipHole(false);
        setComplete(true);
      }, FLIP_DELAY_MS);
      return () => clearTimeout(t);
    }

    if (phase === 1 && fullHand.length > 2) {
      const t = setTimeout(() => {
        setFlipHole(false);
        setAnimatingCardIndex(2);
        setPhase(2);
      }, FLIP_DELAY_MS);
      return () => clearTimeout(t);
    }

    if (phase >= 2 && phase < maxPhase) {
      const t = setTimeout(() => {
        setAnimatingCardIndex(phase + 1);
        setPhase(phase + 1);
      }, DRAW_DELAY_MS);
      return () => clearTimeout(t);
    }

    if (phase >= 2 && phase === maxPhase) {
      const t = setTimeout(() => {
        setAnimatingCardIndex(null);
        setComplete(true);
      }, DRAW_DELAY_MS);
      return () => clearTimeout(t);
    }

    if (phase === 1 && fullHand.length <= 2) {
      return;
    }
  }, [needsAnimation, phase, complete, fullHand.length]);

  const displayedHand =
    needsAnimation && !complete
      ? dealerCardsForPhase(fullHand, phase)
      : state.dealerHand;

  const displayedTotal = handTotal(
    needsAnimation && !complete
      ? displayedHand
      : state.dealerHand.map((c) => ({ ...c, hidden: false }))
  );

  const isAnimating = needsAnimation && !complete;

  return {
    displayedHand,
    displayedTotal,
    isAnimating,
    animatingCardIndex,
    flipHole: flipHole && phase === 1,
    complete: !needsAnimation || complete,
  };
}
