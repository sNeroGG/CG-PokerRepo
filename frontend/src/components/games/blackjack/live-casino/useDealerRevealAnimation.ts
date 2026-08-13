"use client";

import { useEffect, useState } from "react";
import type { BlackjackState, Card } from "@cg/backend/types";
import { handTotal } from "@/lib/game-logic/deck";
import {
  computeRevealState,
  dealerRevealBoundariesMs,
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
  const waitingForCurrentDeal = !enabled && isRoundEnd && handLen >= 1;
  const revealAt = state.dealerRevealAt;

  const animationKey = needsAnimation ? `${revealAt ?? "local"}:${signature}` : "";
  const [timeline, setTimeline] = useState({ key: "", elapsed: 0 });

  useEffect(() => {
    if (!needsAnimation || !animationKey) {
      return;
    }

    setTimeline({ key: animationKey, elapsed: 0 });
    const timers = dealerRevealBoundariesMs(handLen).map((boundary) =>
      window.setTimeout(
        () =>
          setTimeline((current) =>
            current.key === animationKey
              ? { key: animationKey, elapsed: boundary }
              : current
          ),
        boundary
      )
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [animationKey, handLen, needsAnimation]);

  if (!needsAnimation) {
    const waitingHand = waitingForCurrentDeal
      ? dealerCardsForPhase(fullHand, 0)
      : state.dealerHand;
    return {
      displayedHand: waitingHand,
      displayedTotal: handTotal(
        waitingForCurrentDeal
          ? waitingHand
          : state.dealerHand.map((c) => ({ ...c, hidden: false }))
      ),
      isAnimating: false,
      animatingCardIndex: null as number | null,
      flipHole: false,
      complete: !waitingForCurrentDeal,
      stage: (waitingForCurrentDeal ? "pause" : "done") as DealerRevealStage,
      visibleCount: waitingForCurrentDeal ? Math.min(1, handLen) : handLen,
      totalCount: handLen,
    };
  }

  const elapsed = timeline.key === animationKey ? timeline.elapsed : 0;
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
