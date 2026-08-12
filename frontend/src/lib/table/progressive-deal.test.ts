import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CARD_DEAL_INTERVAL_MS } from "@/lib/table/deal-sequence";
import { computeProgressiveDeal } from "@/lib/table/progressive-deal";

describe("computeProgressiveDeal", () => {
  it("marca completo si no hay batch", () => {
    assert.deepEqual(computeProgressiveDeal(undefined, undefined, 1000), {
      visibleGlobal: Number.MAX_SAFE_INTEGER,
      complete: true,
      isDealing: false,
    });
  });

  it("usa reloj de servidor: late joiner salta al frame correcto", () => {
    const started = 10_000;
    const count = 6;
    const late = started + CARD_DEAL_INTERVAL_MS * 3 + 10;
    const view = computeProgressiveDeal(started, count, late);
    assert.equal(view.visibleGlobal, 4);
    assert.equal(view.complete, false);
    assert.equal(view.isDealing, true);
  });

  it("queda alineado entre dos clientes con el mismo now", () => {
    const started = 50_000;
    const count = 8;
    const now = started + CARD_DEAL_INTERVAL_MS * 2;
    const a = computeProgressiveDeal(started, count, now);
    const b = computeProgressiveDeal(started, count, now);
    assert.deepEqual(a, b);
    assert.equal(a.visibleGlobal, 3);
  });

  it("hit/double (1 carta) anima antes de completar", () => {
    const started = 1_000;
    const atStart = computeProgressiveDeal(started, 1, started);
    assert.equal(atStart.visibleGlobal, 1);
    assert.equal(atStart.complete, false);
    assert.equal(atStart.isDealing, true);

    const mid = computeProgressiveDeal(
      started,
      1,
      started + CARD_DEAL_INTERVAL_MS - 1
    );
    assert.equal(mid.complete, false);
    assert.equal(mid.isDealing, true);

    const done = computeProgressiveDeal(
      started,
      1,
      started + CARD_DEAL_INTERVAL_MS
    );
    assert.equal(done.visibleGlobal, 1);
    assert.equal(done.complete, true);
    assert.equal(done.isDealing, false);
  });

  it("completa solo tras el intervalo de la última carta", () => {
    const started = 1_000;
    const count = 4;
    const lastCardAt = started + CARD_DEAL_INTERVAL_MS * (count - 1);
    const stillAnimating = computeProgressiveDeal(started, count, lastCardAt);
    assert.equal(stillAnimating.visibleGlobal, 4);
    assert.equal(stillAnimating.complete, false);

    const doneAt = started + CARD_DEAL_INTERVAL_MS * count;
    const view = computeProgressiveDeal(started, count, doneAt);
    assert.equal(view.visibleGlobal, 4);
    assert.equal(view.complete, true);
    assert.equal(view.isDealing, false);
  });
});
