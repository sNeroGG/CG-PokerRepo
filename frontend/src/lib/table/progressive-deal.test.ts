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

  it("completa cuando el elapsed cubre todas las cartas", () => {
    const started = 1_000;
    const count = 4;
    const doneAt = started + CARD_DEAL_INTERVAL_MS * (count - 1);
    const view = computeProgressiveDeal(started, count, doneAt);
    assert.equal(view.visibleGlobal, 4);
    assert.equal(view.complete, true);
    assert.equal(view.isDealing, false);
  });
});
