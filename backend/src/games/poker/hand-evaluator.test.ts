import assert from "node:assert/strict";
import test from "node:test";
import type { Card, Rank, Suit } from "../../types";
import { compareHands, evaluateHand } from "./hand-evaluator";

const suits: Suit[] = ["spades", "hearts", "diamonds", "clubs"];

function cards(ranks: Rank[]): Card[] {
  return ranks.map((rank, index) => ({ rank, suit: suits[index % suits.length] }));
}

test("reconoce las categorías principales", () => {
  const royal = evaluateHand(
    [
      { rank: "A", suit: "spades" },
      { rank: "K", suit: "spades" },
    ],
    [
      { rank: "Q", suit: "spades" },
      { rank: "J", suit: "spades" },
      { rank: "10", suit: "spades" },
      { rank: "2", suit: "hearts" },
      { rank: "3", suit: "clubs" },
    ]
  );
  const quads = evaluateHand(cards(["A", "A"]), cards(["A", "A", "K", "4", "2"]));
  const fullHouse = evaluateHand(cards(["Q", "Q"]), cards(["Q", "7", "7", "3", "2"]));

  assert.equal(royal.rank, 8);
  assert.equal(royal.name, "Escalera Real");
  assert.equal(quads.rank, 7);
  assert.equal(fullHouse.rank, 6);
});

test("la escalera A-2-3-4-5 pierde contra una escalera al seis", () => {
  const wheel = evaluateHand(cards(["A", "2"]), cards(["3", "4", "5", "9", "K"]));
  const sixHigh = evaluateHand(cards(["2", "3"]), cards(["4", "5", "6", "9", "K"]));
  assert.equal(wheel.rank, 4);
  assert.ok(compareHands(sixHigh, wheel) > 0);
});

test("usa todos los kickers para desempatar", () => {
  const aceKing = evaluateHand(cards(["A", "K"]), cards(["A", "9", "7", "4", "2"]));
  const aceQueen = evaluateHand(cards(["A", "Q"]), cards(["A", "9", "7", "4", "2"]));
  assert.ok(compareHands(aceKing, aceQueen) > 0);
});
