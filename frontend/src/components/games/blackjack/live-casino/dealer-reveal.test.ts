import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CARD_DEAL_INTERVAL_MS } from "@/lib/table/deal-sequence";
import {
  DEALER_REVEAL_START_DELAY_MS,
  DEALER_HOLE_FLIP_DURATION_MS,
  computeRevealState,
  dealerCardsForPhase,
} from "./dealer-reveal-timing";

describe("computeRevealState (reloj servidor)", () => {
  it("mantiene la segunda carta oculta mientras termina una carta pedida", () => {
    const waiting = dealerCardsForPhase(
      [
        { suit: "clubs", rank: "10" },
        { suit: "hearts", rank: "A" },
      ],
      0
    );
    assert.equal(waiting[0].hidden, false);
    assert.equal(waiting[1].hidden, true);
  });

  it("está en pausa inicial antes del flip", () => {
    const view = computeRevealState(100, 3);
    assert.equal(view.stage, "pause");
    assert.equal(view.complete, false);
  });

  it("alinea late joiners en la misma fase", () => {
    const elapsed =
      DEALER_REVEAL_START_DELAY_MS + DEALER_HOLE_FLIP_DURATION_MS + 20;
    const a = computeRevealState(elapsed, 4);
    const b = computeRevealState(elapsed, 4);
    assert.deepEqual(a, b);
    assert.equal(a.stage, "draw");
  });

  it("completa cuando ya no quedan cartas por revelar", () => {
    const handLen = 4;
    const elapsed =
      DEALER_REVEAL_START_DELAY_MS +
      DEALER_HOLE_FLIP_DURATION_MS +
      CARD_DEAL_INTERVAL_MS * 2;
    const view = computeRevealState(elapsed, handLen);
    assert.equal(view.complete, true);
    assert.equal(view.visibleCount, handLen);
  });

  it("mantiene la carta oculta durante todo el giro y la revela al finalizar", () => {
    const during = computeRevealState(
      DEALER_REVEAL_START_DELAY_MS + DEALER_HOLE_FLIP_DURATION_MS - 1,
      2
    );
    const after = computeRevealState(
      DEALER_REVEAL_START_DELAY_MS + DEALER_HOLE_FLIP_DURATION_MS,
      2
    );

    assert.equal(during.stage, "flip");
    assert.equal(during.flipHole, true);
    assert.equal(during.animatingCardIndex, 1);
    assert.equal(after.stage, "done");
    assert.equal(after.visibleCount, 2);
  });
});
