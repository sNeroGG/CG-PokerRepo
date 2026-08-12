import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { blackjackEngine } from "../games/blackjack/engine";
import { pokerEngine } from "../games/poker/engine";
import {
  MAX_ROOM_PLAYERS,
  getPublicRoom,
  roomStateForBroadcast,
} from "./public-room";
import type { PokerState, Room } from "../types";

describe("capacidad 2-8 jugadores", () => {
  it("engines y sala permiten hasta 8", () => {
    assert.equal(MAX_ROOM_PLAYERS, 8);
    assert.equal(blackjackEngine.maxPlayers, 8);
    assert.equal(pokerEngine.maxPlayers, 8);
    assert.equal(pokerEngine.minPlayers, 2);
    assert.ok(blackjackEngine.minPlayers <= 2);
  });
});

describe("roomStateForBroadcast", () => {
  it("oculta hole cards de todos y vacía el mazo", () => {
    const state: PokerState = {
      type: "poker",
      phase: "preflop",
      deck: [
        { suit: "hearts", rank: "2" },
        { suit: "clubs", rank: "3" },
      ],
      communityCards: [],
      players: [
        {
          playerId: "p1",
          holeCards: [
            { suit: "spades", rank: "A" },
            { suit: "spades", rank: "K" },
          ],
          bet: 10,
          totalBet: 10,
          folded: false,
          allIn: false,
          lastAction: "call",
        },
        {
          playerId: "p2",
          holeCards: [
            { suit: "hearts", rank: "Q" },
            { suit: "hearts", rank: "J" },
          ],
          bet: 20,
          totalBet: 20,
          folded: false,
          allIn: false,
          lastAction: "raise",
        },
      ],
      currentPlayerIndex: 0,
      pot: 30,
      currentBet: 20,
      dealerIndex: 0,
      smallBlind: 5,
      bigBlind: 10,
      winners: [],
      message: "ok",
      dealerMessage: "",
      dealStartedAt: 123,
      dealCardCount: 4,
    };

    const room: Room = {
      code: "TEST01",
      hostId: "p1",
      gameType: "poker",
      status: "playing",
      players: [
        {
          id: "p1",
          name: "Uno",
          chips: 1000,
          isHost: true,
          isConnected: true,
          joinedAt: 1,
        },
        {
          id: "p2",
          name: "Dos",
          chips: 1000,
          isHost: false,
          isConnected: true,
          joinedAt: 2,
        },
      ],
      gameState: state,
      createdAt: 1,
      updatedAt: 99,
    };

    const shared = roomStateForBroadcast(room);
    const gs = shared.gameState as PokerState;
    assert.deepEqual(gs.deck, []);
    assert.equal(
      gs.players.every((p) => p.holeCards.every((c) => c.hidden)),
      true
    );
    assert.equal(gs.dealStartedAt, 123);

    const forP1 = getPublicRoom(room, "p1").gameState as PokerState;
    assert.notEqual(
      forP1.players.find((p) => p.playerId === "p1")!.holeCards[0].hidden,
      true
    );
    assert.deepEqual(forP1.deck, []);
  });
});
