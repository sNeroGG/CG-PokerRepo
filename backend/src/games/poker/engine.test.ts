import assert from "node:assert/strict";
import test from "node:test";
import type { Card, Player, PokerPlayerState, PokerState } from "../../types";
import {
  applyPokerTimeout,
  buildPokerPots,
  pokerEngine,
  settlePokerShowdown,
} from "./engine";

function players(count: number, chips = 1_000): Player[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `player-${index}`,
    name: `Jugador ${index + 1}`,
    chips,
    isHost: index === 0,
    isConnected: true,
    joinedAt: index,
    seatStatus: "active",
  }));
}

function card(rank: Card["rank"], suit: Card["suit"]): Card {
  return { rank, suit };
}

test("inicia una mano de 8 jugadores con 16 cartas privadas únicas", () => {
  const initial = pokerEngine.createInitialState(players(8));
  const state = pokerEngine.applyAction(initial, "player-0", { type: "startHand" });
  const dealt = state.players.flatMap((player) => player.holeCards);

  assert.equal(state.players.length, 8);
  assert.equal(dealt.length, 16);
  assert.equal(new Set(dealt.map((entry) => `${entry.rank}-${entry.suit}`)).size, 16);
  assert.equal(state.pot, 30);
  assert.equal(state.dealerIndex, 0);
  assert.equal(state.smallBlindIndex, 1);
  assert.equal(state.bigBlindIndex, 2);
});

test("all-in usa el stack real y no una constante", () => {
  const initial = pokerEngine.createInitialState([
    ...players(1, 120),
    { ...players(1, 1_000)[0], id: "player-1", name: "Jugador 2", isHost: false },
  ]);
  const started = pokerEngine.applyAction(initial, "player-0", { type: "startHand" });
  assert.equal(started.currentPlayerIndex, 0);

  const state = pokerEngine.applyAction(started, "player-0", { type: "all-in" });
  const player = state.players.find((entry) => entry.playerId === "player-0")!;
  assert.equal(player.stack, 0);
  assert.equal(player.totalBet, 120);
  assert.equal(player.allIn, true);
});

test("construye bote principal y lateral con stacks distintos", () => {
  const committed = [100, 300, 300].map((totalBet, index) => ({
    playerId: `p${index}`,
    holeCards: [],
    bet: totalBet,
    totalBet,
    folded: false,
    allIn: true,
    lastAction: "all-in" as const,
    stack: 0,
    acted: true,
  }));
  assert.deepEqual(buildPokerPots(committed), [
    { amount: 300, eligiblePlayerIds: ["p0", "p1", "p2"] },
    { amount: 400, eligiblePlayerIds: ["p1", "p2"] },
  ]);
});

test("showdown paga side pots por elegibilidad y conserva todas las fichas", () => {
  const pokerPlayers: PokerPlayerState[] = [
    {
      playerId: "aces",
      holeCards: [card("A", "hearts"), card("A", "clubs")],
      bet: 100,
      totalBet: 100,
      folded: false,
      allIn: true,
      lastAction: "all-in",
      stack: 0,
      acted: true,
    },
    {
      playerId: "kings",
      holeCards: [card("K", "hearts"), card("K", "clubs")],
      bet: 300,
      totalBet: 300,
      folded: false,
      allIn: true,
      lastAction: "all-in",
      stack: 0,
      acted: true,
    },
    {
      playerId: "queens",
      holeCards: [card("Q", "hearts"), card("Q", "clubs")],
      bet: 300,
      totalBet: 300,
      folded: false,
      allIn: true,
      lastAction: "all-in",
      stack: 0,
      acted: true,
    },
  ];
  const base = pokerEngine.createInitialState(players(3)) as PokerState;
  const result = settlePokerShowdown({
    ...base,
    phase: "river",
    players: pokerPlayers,
    communityCards: [
      card("2", "clubs"),
      card("4", "diamonds"),
      card("6", "hearts"),
      card("8", "spades"),
      card("10", "clubs"),
    ],
    pot: 700,
    dealerIndex: 2,
  });

  assert.equal(result.players.find((player) => player.playerId === "aces")?.stack, 300);
  assert.equal(result.players.find((player) => player.playerId === "kings")?.stack, 400);
  assert.equal(result.players.reduce((sum, player) => sum + player.stack, 0), 700);
});

test("timeout hace check sin apuesta pendiente y fold cuando debe igualar", () => {
  const initial = pokerEngine.createInitialState(players(2));
  const started = pokerEngine.applyAction(initial, "player-0", { type: "startHand" });
  const current = started.players[started.currentPlayerIndex];
  const timedOut = applyPokerTimeout({ ...started, turnDeadlineAt: 1 }, 2);
  assert.equal(
    timedOut.players.find((player) => player.playerId === current.playerId)?.folded,
    true
  );
});
