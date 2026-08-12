"use client";

import { useEffect, useRef, useState } from "react";
import type { BlackjackState, Card } from "@cg/backend/types";
import { handTotal } from "@/lib/game-logic/deck";
import {
  computeRevealState,
  dealerCardsForPhase,
  type DealerRevealStage,
} from "./dealer-reveal-timing";

export {
  computeRevealState,
  dealerCardsForPhase,
  type DealerRevealStage,
} from "./dealer-reveal-timing";

function handSignature(hand: Card[]) {
  return hand.map((c) => `${c.rank}${c.suit}`).join("|");
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

  const lastSignatureRef = useRef("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!needsAnimation || !revealAt) {
      lastSignatureRef.current = "";
      return;
    }

    if (signature !== lastSignatureRef.current) {
      lastSignatureRef.current = signature;
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

  const anchor = revealAt ?? Date.now();
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
