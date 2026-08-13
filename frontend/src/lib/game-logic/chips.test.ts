import assert from "node:assert/strict";
import test from "node:test";
import { decomposeIntoChips, groupChipStacks } from "./chips";

function total(chips: ReturnType<typeof decomposeIntoChips>): number {
  return chips.reduce((sum, chip) => sum + chip.value, 0);
}

test("cambia cuatro fichas de 100 por una de 500", () => {
  const fourHundred = decomposeIntoChips(400);
  const fiveHundred = decomposeIntoChips(500);

  assert.deepEqual(fourHundred.map((chip) => chip.value), [100, 100, 100, 100]);
  assert.deepEqual(fiveHundred.map((chip) => chip.value), [500]);
});

test("normaliza cada salto de denominación sin conservar fichas inferiores", () => {
  assert.deepEqual(decomposeIntoChips(1_000).map((chip) => chip.value), [1_000]);
  assert.deepEqual(decomposeIntoChips(5_000).map((chip) => chip.value), [5_000]);
  assert.deepEqual(decomposeIntoChips(10_000).map((chip) => chip.value), [10_000]);
  assert.deepEqual(decomposeIntoChips(1_900).map((chip) => chip.value), [
    1_000,
    500,
    100,
    100,
    100,
    100,
  ]);
});

test("el límite visual nunca pierde valor", () => {
  for (const amount of [90, 450, 1_900, 8_800, 23_450]) {
    const chips = decomposeIntoChips(amount, 4);
    assert.ok(chips.length <= 4);
    assert.equal(total(chips), amount);
  }
});

test("las pilas agrupadas representan el monto una sola vez", () => {
  for (const amount of [400, 500, 900, 1_500, 8_800]) {
    const represented = groupChipStacks(amount).reduce(
      (sum, group) => sum + group.denom.value * group.count,
      0
    );
    assert.equal(represented, amount);
  }
  assert.deepEqual(
    groupChipStacks(500).map(({ denom, count }) => [denom.value, count]),
    [[500, 1]]
  );
});
