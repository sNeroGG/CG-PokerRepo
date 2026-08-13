import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEALER_DRAW_INTERVAL_MS,
  DEALER_REVEAL_START_DELAY_MS,
  DEALER_HOLE_FLIP_DURATION_MS,
  DEALER_REVEAL_SETTLE_MS,
  computeRevealState,
  dealerRevealBoundariesMs,
  dealerRevealDurationMs,
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
      DEALER_REVEAL_START_DELAY_MS +
      DEALER_HOLE_FLIP_DURATION_MS +
      DEALER_REVEAL_SETTLE_MS +
      20;
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
      DEALER_REVEAL_SETTLE_MS +
      DEALER_DRAW_INTERVAL_MS * 2;
    const view = computeRevealState(elapsed, handLen);
    assert.equal(view.complete, true);
    assert.equal(view.visibleCount, handLen);
  });

  it("mantiene la carta oculta durante el giro y hace una pausa antes del resultado", () => {
    const during = computeRevealState(
      DEALER_REVEAL_START_DELAY_MS + DEALER_HOLE_FLIP_DURATION_MS - 1,
      2
    );
    const settling = computeRevealState(
      DEALER_REVEAL_START_DELAY_MS + DEALER_HOLE_FLIP_DURATION_MS,
      2
    );
    const after = computeRevealState(
      DEALER_REVEAL_START_DELAY_MS +
        DEALER_HOLE_FLIP_DURATION_MS +
        DEALER_REVEAL_SETTLE_MS,
      2
    );

    assert.equal(during.stage, "flip");
    assert.equal(during.flipHole, true);
    assert.equal(during.animatingCardIndex, 1);
    assert.equal(settling.stage, "settle");
    assert.equal(settling.complete, false);
    assert.equal(settling.visibleCount, 2);
    assert.equal(after.stage, "done");
    assert.equal(after.visibleCount, 2);
  });

  it("no completa ni permite resultado antes de toda la secuencia visible", () => {
    const duration = dealerRevealDurationMs(2);
    assert.equal(duration, 3600);
    assert.equal(computeRevealState(duration - 1, 2).complete, false);
    assert.equal(computeRevealState(duration, 2).complete, true);
    assert.equal(dealerRevealDurationMs(4), 5800);
  });

  it("solo programa renders cuando cambia la etapa visible", () => {
    assert.deepEqual(dealerRevealBoundariesMs(2), [1000, 2600, 3600]);
    assert.deepEqual(dealerRevealBoundariesMs(4), [1000, 2600, 3600, 4700, 5800]);
  });
});
