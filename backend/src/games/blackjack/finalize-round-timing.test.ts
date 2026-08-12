import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { blackjackEngine } from "./engine";
import type { BlackjackState } from "../../types";

const DEAL_INTERVAL_MS = 850;

describe("finalizeRound timing tras hit/double", () => {
  it("retrasa dealerRevealAt hasta terminar la carta de double", () => {
    const ready: BlackjackState = {
      type: "blackjack",
      phase: "playerTurn",
      deck: Array.from({ length: 40 }, (_, i) => ({
        suit: "clubs" as const,
        rank: (i % 2 === 0 ? "2" : "4") as "2" | "4",
      })),
      dealerHand: [
        { suit: "hearts", rank: "9" },
        { suit: "clubs", rank: "7", hidden: true },
      ],
      players: [
        {
          playerId: "p1",
          currentHandIndex: 0,
          hands: [
            {
              cards: [
                { suit: "spades", rank: "5" },
                { suit: "diamonds", rank: "6" },
              ],
              bet: 50,
              status: "active",
            },
          ],
        },
      ],
      currentPlayerIndex: 0,
      minBet: 10,
      blackjackPayout: "3:2",
      allowSurrender: true,
      message: "Tu turno",
      dealerMessage: "",
    };

    const next = blackjackEngine.applyAction(ready, "p1", { type: "double" });

    assert.ok(next.dealStartedAt, "debe stampear deal de la carta de double");
    assert.equal(next.dealCardCount, 1);
    assert.ok(next.dealerRevealAt, "debe stampear reveal del crupier");
    assert.equal(next.phase, "roundEnd");

    const expectedMin = (next.dealStartedAt as number) + DEAL_INTERVAL_MS;
    assert.ok(
      (next.dealerRevealAt as number) >= expectedMin - 5,
      `dealerRevealAt (${next.dealerRevealAt}) debe ser >= dealEnd (${expectedMin})`
    );
  });

  it("retrasa dealerRevealAt tras hit que termina la ronda (bust solo)", () => {
    const ready: BlackjackState = {
      type: "blackjack",
      phase: "playerTurn",
      // Cartas altas para forzar bust al pedir
      deck: [
        { suit: "hearts", rank: "K" },
        { suit: "clubs", rank: "Q" },
        { suit: "diamonds", rank: "J" },
      ],
      dealerHand: [
        { suit: "hearts", rank: "9" },
        { suit: "clubs", rank: "7", hidden: true },
      ],
      players: [
        {
          playerId: "p1",
          currentHandIndex: 0,
          hands: [
            {
              cards: [
                { suit: "spades", rank: "K" },
                { suit: "diamonds", rank: "9" },
              ],
              bet: 50,
              status: "active",
            },
          ],
        },
      ],
      currentPlayerIndex: 0,
      minBet: 10,
      blackjackPayout: "3:2",
      allowSurrender: true,
      message: "Tu turno",
      dealerMessage: "",
    };

    const next = blackjackEngine.applyAction(ready, "p1", { type: "hit" });
    assert.equal(next.phase, "roundEnd");
    assert.equal(next.dealCardCount, 1);
    assert.ok(next.dealStartedAt);
    assert.ok(next.dealerRevealAt);

    const expectedMin = (next.dealStartedAt as number) + DEAL_INTERVAL_MS;
    assert.ok((next.dealerRevealAt as number) >= expectedMin - 5);
  });
});
