import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BlackjackState, PokerState, Room } from "@cg/backend/types";
import {
  mergeRoomUpdate,
  shouldApplyRoomUpdate,
} from "@/lib/room/merge-room-update";

const card = (rank: "A" | "K" | "Q", hidden = false) =>
  ({ suit: "spades" as const, rank, hidden });

function baseRoom(partial: Partial<Room> & { gameState: Room["gameState"] }): Room {
  return {
    code: "ABC123",
    hostId: "host",
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
    createdAt: 1,
    updatedAt: 100,
    version: 1,
    ...partial,
  };
}

describe("shouldApplyRoomUpdate", () => {
  it("acepta el primer estado y rechaza updates viejos", () => {
    const current = baseRoom({
      updatedAt: 200,
      gameState: null,
    });
    assert.equal(shouldApplyRoomUpdate(null, current), true);
    assert.equal(
      shouldApplyRoomUpdate(current, { ...current, updatedAt: 150 }),
      false
    );
    assert.equal(
      shouldApplyRoomUpdate(current, { ...current, updatedAt: 250 }),
      true
    );
    // Mismo revision: Broadcast no pisa; el GET personalizado sí (>=) en useRoom
    assert.equal(
      shouldApplyRoomUpdate(current, { ...current, updatedAt: 200 }),
      false
    );
  });
});

describe("mergeRoomUpdate poker", () => {
  it("conserva hole cards propias ante snapshot compartido", () => {
    const prevState: PokerState = {
      type: "poker",
      phase: "preflop",
      deck: [],
      communityCards: [],
      players: [
        {
          playerId: "p1",
          holeCards: [card("A"), card("K")],
          bet: 10,
          totalBet: 10,
          folded: false,
          allIn: false,
          lastAction: "call",
          stack: 990,
          acted: true,
        },
        {
          playerId: "p2",
          holeCards: [card("Q", true), card("Q", true)],
          bet: 20,
          totalBet: 20,
          folded: false,
          allIn: false,
          lastAction: "raise",
          stack: 980,
          acted: true,
        },
      ],
      currentPlayerIndex: 0,
      pot: 30,
      currentBet: 20,
      dealerIndex: 0,
      smallBlindIndex: 0,
      bigBlindIndex: 1,
      smallBlind: 5,
      bigBlind: 10,
      lastFullRaise: 10,
      pots: [{ amount: 30, eligiblePlayerIds: ["p1", "p2"] }],
      winners: [],
      message: "",
      dealerMessage: "",
      dealStartedAt: 1000,
      dealCardCount: 4,
    };

    const incomingState: PokerState = {
      ...prevState,
      pot: 40,
      players: prevState.players.map((ps) => ({
        ...ps,
        holeCards: ps.holeCards.map((c) => ({ ...c, hidden: true })),
      })),
    };

    const prev = baseRoom({ updatedAt: 100, gameState: prevState });
    const incoming = baseRoom({ updatedAt: 200, gameState: incomingState });

    const { room, needsPrivateRefetch } = mergeRoomUpdate(prev, incoming, "p1");
    const me = (room.gameState as PokerState).players.find((p) => p.playerId === "p1")!;
    assert.equal(needsPrivateRefetch, false);
    assert.equal(me.holeCards[0].hidden, false);
    assert.equal(me.holeCards[0].rank, "A");
    assert.equal((room.gameState as PokerState).pot, 40);
  });

  it("pide refetch si llega una mano nueva sin cartas conocidas", () => {
    const prevState: PokerState = {
      type: "poker",
      phase: "roundEnd",
      deck: [],
      communityCards: [],
      players: [
        {
          playerId: "p1",
          holeCards: [card("A"), card("K")],
          bet: 0,
          totalBet: 0,
          folded: false,
          allIn: false,
          lastAction: null,
          stack: 1000,
          acted: false,
        },
      ],
      currentPlayerIndex: 0,
      pot: 0,
      currentBet: 0,
      dealerIndex: 0,
      smallBlindIndex: 0,
      bigBlindIndex: 0,
      smallBlind: 5,
      bigBlind: 10,
      lastFullRaise: 10,
      pots: [],
      winners: [],
      message: "",
      dealerMessage: "",
      dealStartedAt: 1000,
      dealCardCount: 2,
    };

    const incomingState: PokerState = {
      ...prevState,
      phase: "preflop",
      dealStartedAt: 5000,
      players: [
        {
          playerId: "p1",
          holeCards: [card("A", true), card("K", true)],
          bet: 10,
          totalBet: 10,
          folded: false,
          allIn: false,
          lastAction: null,
          stack: 990,
          acted: false,
        },
      ],
    };

    const prev = baseRoom({ updatedAt: 100, gameState: prevState });
    const incoming = baseRoom({ updatedAt: 200, gameState: incomingState });
    const { needsPrivateRefetch } = mergeRoomUpdate(prev, incoming, "p1");
    assert.equal(needsPrivateRefetch, true);
  });
});

describe("mergeRoomUpdate blackjack", () => {
  it("conserva cartas propias del viewer", () => {
    const prevState: BlackjackState = {
      type: "blackjack",
      phase: "playerTurn",
      deck: [],
      dealerHand: [card("A"), card("K", true)],
      players: [
        {
          playerId: "p1",
          hands: [
            {
              cards: [card("Q"), card("A")],
              bet: 25,
              status: "active",
            },
          ],
          currentHandIndex: 0,
        },
      ],
      currentPlayerIndex: 0,
      minBet: 10,
      blackjackPayout: "3:2",
      allowSurrender: true,
      message: "",
      dealerMessage: "",
      dealStartedAt: 2000,
      dealCardCount: 4,
    };

    const incomingState: BlackjackState = {
      ...prevState,
      message: "Turno",
      players: [
        {
          playerId: "p1",
          hands: [
            {
              cards: [card("Q", true), card("A", true)],
              bet: 25,
              status: "active",
            },
          ],
          currentHandIndex: 0,
        },
      ],
    };

    const prev = baseRoom({
      gameType: "blackjack",
      updatedAt: 100,
      gameState: prevState,
    });
    const incoming = baseRoom({
      gameType: "blackjack",
      updatedAt: 200,
      gameState: incomingState,
    });

    const { room, needsPrivateRefetch } = mergeRoomUpdate(prev, incoming, "p1");
    const hand = (room.gameState as BlackjackState).players[0].hands[0];
    assert.equal(needsPrivateRefetch, false);
    assert.equal(hand.cards.every((c) => !c.hidden), true);
    assert.equal(hand.cards[0].rank, "Q");
  });
});
