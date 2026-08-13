import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CARD_DEAL_INTERVAL_MS } from "@/lib/table/deal-sequence";
import {
  computeProgressiveDeal,
  resolvePresentationStart,
  resolveUpdatedBatchStart,
} from "@/lib/table/progressive-deal";

describe("resolvePresentationStart", () => {
  it("arranca en local now si el RTT aún no consumió el deal (hit)", () => {
    const dealStartedAt = 10_000;
    const now = 10_000 + 400; // RTT 400ms < 850ms
    const start = resolvePresentationStart(dealStartedAt, 1, now);
    assert.equal(start, now);
  });

  it("hace snap al servidor si el deal ya terminó", () => {
    const dealStartedAt = 10_000;
    const now = 10_000 + CARD_DEAL_INTERVAL_MS + 50;
    const start = resolvePresentationStart(dealStartedAt, 1, now);
    assert.equal(start, dealStartedAt);
  });

  it("una carta pedida siempre inicia su animación local aunque la API tarde", () => {
    const dealStartedAt = 10_000;
    const receivedAt = dealStartedAt + CARD_DEAL_INTERVAL_MS + 500;
    assert.equal(resolveUpdatedBatchStart(dealStartedAt, 1, receivedAt), receivedAt);
  });
});

describe("computeProgressiveDeal", () => {
  it("marca completo si no hay batch", () => {
    assert.deepEqual(computeProgressiveDeal(undefined, undefined, 1000), {
      visibleGlobal: Number.MAX_SAFE_INTEGER,
      complete: true,
      isDealing: false,
    });
  });

  it("hit/double (1 carta) anima el intervalo completo desde ancla local", () => {
    const started = 50_000;
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

    const done = computeProgressiveDeal(
      started,
      1,
      started + CARD_DEAL_INTERVAL_MS
    );
    assert.equal(done.complete, true);
    assert.equal(done.isDealing, false);
  });

  it("late joiner con ancla local ve la misma secuencia", () => {
    const started = 80_000;
    const a = computeProgressiveDeal(started, 4, started + CARD_DEAL_INTERVAL_MS);
    const b = computeProgressiveDeal(started, 4, started + CARD_DEAL_INTERVAL_MS);
    assert.deepEqual(a, b);
    assert.equal(a.visibleGlobal, 2);
    assert.equal(a.complete, false);
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
    assert.equal(view.complete, true);
  });
});
