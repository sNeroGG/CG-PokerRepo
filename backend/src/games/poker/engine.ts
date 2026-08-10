import { createDeck, drawCards, shuffleDeck } from "../../lib/deck";
import type {
  GameActionPayload,
  Player,
  PokerActionType,
  PokerPlayerState,
  PokerState,
} from "../../types";
import type { GameEngine } from "../engine";
import { compareHands, evaluateHand } from "./hand-evaluator";

const STARTING_CHIPS = 1000;
const SMALL_BLIND = 10;
const BIG_BLIND = 20;

function activePlayers(state: PokerState): PokerPlayerState[] {
  return state.players.filter((p) => !p.folded);
}

function playersToAct(state: PokerState): PokerPlayerState[] {
  return activePlayers(state).filter((p) => !p.allIn);
}

function allBetsEqual(state: PokerState): boolean {
  const active = activePlayers(state);
  const maxBet = Math.max(...active.map((p) => p.bet));
  return active.every((p) => p.bet === maxBet || p.allIn);
}

function nextPlayerIndex(state: PokerState, from: number): number {
  const n = state.players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (from + i) % n;
    const p = state.players[idx];
    if (!p.folded && !p.allIn) return idx;
  }
  return from;
}

function dealHoleCards(state: PokerState, roomPlayers: Player[]): PokerState {
  let deck = [...state.deck];
  const players: PokerPlayerState[] = state.players.map((p) => {
    const { drawn, remaining } = drawCards(deck, 2);
    deck = remaining;
    return {
      ...p,
      holeCards: drawn,
      bet: 0,
      totalBet: 0,
      folded: false,
      allIn: false,
      lastAction: null,
    };
  });

  const sbIdx = (state.dealerIndex + 1) % players.length;
  const bbIdx = (state.dealerIndex + 2) % players.length;

  const postBlind = (idx: number, amount: number) => {
    const rp = roomPlayers.find((r) => r.id === players[idx].playerId);
    const actual = Math.min(amount, rp?.chips ?? amount);
    if (rp) rp.chips -= actual;
    players[idx] = {
      ...players[idx],
      bet: actual,
      totalBet: actual,
      allIn: actual < amount,
      lastAction: "call",
    };
  };

  postBlind(sbIdx, SMALL_BLIND);
  postBlind(bbIdx, BIG_BLIND);

  const firstToAct = players.length === 2 ? sbIdx : (bbIdx + 1) % players.length;

  return {
    ...state,
    deck,
    players,
    phase: "preflop",
    pot: players.reduce((s, p) => s + p.bet, 0),
    currentBet: BIG_BLIND,
    currentPlayerIndex: firstToAct,
    communityCards: [],
    winners: [],
    message: "Pre-flop — tu turno",
    dealerMessage: "CPU repartió cartas y ciegas.",
    dealStartedAt: Date.now(),
    dealCardCount: players.length * 2,
  };
}

function advancePhase(state: PokerState, roomPlayers: Player[]): PokerState {
  const active = activePlayers(state);
  if (active.length === 1) {
    const winner = active[0];
    const rp = roomPlayers.find((r) => r.id === winner.playerId);
    if (rp) rp.chips += state.pot;
    return {
      ...state,
      phase: "roundEnd",
      winners: [{ playerId: winner.playerId, amount: state.pot, hand: "Todos fold" }],
      message: "¡Ganador por abandono!",
      dealerMessage: "Ronda terminada.",
    };
  }

  const resetBets = state.players.map((p) => ({ ...p, bet: 0, lastAction: null }));
  let deck = [...state.deck];
  let community = [...state.communityCards];
  let phase = state.phase;
  let message = "";

  if (phase === "preflop") {
    const d = drawCards(deck, 3);
    community = d.drawn;
    deck = d.remaining;
    phase = "flop";
    message = "Flop revelado";
  } else if (phase === "flop") {
    const d = drawCards(deck, 1);
    community = [...community, ...d.drawn];
    deck = d.remaining;
    phase = "turn";
    message = "Turn revelado";
  } else if (phase === "turn") {
    const d = drawCards(deck, 1);
    community = [...community, ...d.drawn];
    deck = d.remaining;
    phase = "river";
    message = "River revelado";
  } else if (phase === "river") {
    return showdown({ ...state, players: resetBets }, roomPlayers);
  }

  const firstActive = resetBets.findIndex((p) => !p.folded && !p.allIn);

  const prevCommunityLen = state.communityCards.length;
  const newCardsDealt = community.length - prevCommunityLen;

  return {
    ...state,
    deck,
    communityCards: community,
    players: resetBets,
    phase,
    currentBet: 0,
    currentPlayerIndex: firstActive >= 0 ? firstActive : 0,
    message,
    dealerMessage: `CPU reparte cartas comunitarias (${phase}).`,
    dealStartedAt: Date.now(),
    dealCardCount: newCardsDealt,
    dealSlots: newCardsDealt > 0 ? ["community"] : undefined,
  };
}

function showdown(state: PokerState, roomPlayers: Player[]): PokerState {
  const active = activePlayers(state);
  const evaluations = active.map((p) => ({
    playerId: p.playerId,
    eval: evaluateHand(p.holeCards, state.communityCards),
  }));

  evaluations.sort((a, b) => compareHands(b.eval, a.eval));
  const bestRank = evaluations[0].eval.rank;
  const winners = evaluations.filter((e) => e.eval.rank === bestRank);
  const share = Math.floor(state.pot / winners.length);

  const winnerResults = winners.map((w) => {
    const rp = roomPlayers.find((r) => r.id === w.playerId);
    if (rp) rp.chips += share;
    return { playerId: w.playerId, amount: share, hand: w.eval.name };
  });

  return {
    ...state,
    phase: "showdown",
    winners: winnerResults,
    message: `¡${winnerResults.map((w) => w.hand).join(" vs ")}!`,
    dealerMessage: "Showdown — CPU revela manos.",
  };
}

function isBettingRoundComplete(state: PokerState): boolean {
  const toAct = playersToAct(state);
  if (toAct.length <= 1 && allBetsEqual(state)) return true;
  if (toAct.length === 0) return true;

  const active = activePlayers(state);
  const allActed = active.every((p) => p.allIn || p.lastAction !== null);
  return allActed && allBetsEqual(state);
}

export const pokerEngine: GameEngine<PokerState> = {
  id: "poker",
  name: "Texas Hold'em",
  description: "Póker Texas Hold'em multijugador. CPU reparte y gestiona el mazo.",
  minPlayers: 2,
  maxPlayers: 6,
  icon: "♠️",

  createInitialState(players: Player[]): PokerState {
    return {
      type: "poker",
      phase: "waiting",
      deck: shuffleDeck(createDeck()),
      communityCards: [],
      players: players.map((p) => ({
        playerId: p.id,
        holeCards: [],
        bet: 0,
        totalBet: 0,
        folded: false,
        allIn: false,
        lastAction: null,
      })),
      pot: 0,
      currentBet: 0,
      currentPlayerIndex: 0,
      dealerIndex: 0,
      smallBlind: SMALL_BLIND,
      bigBlind: BIG_BLIND,
      winners: [],
      message: "Esperando inicio de mano...",
      dealerMessage: "CPU Crupier listo.",
    };
  },

  getValidActions(state, playerId) {
    const ps = state.players.find((p) => p.playerId === playerId);
    if (!ps || ps.folded || ps.allIn) return [];

    if (state.phase === "waiting" || state.phase === "roundEnd" || state.phase === "showdown") {
      return [{ type: "startHand" }];
    }

    const phases = ["preflop", "flop", "turn", "river"];
    if (!phases.includes(state.phase)) return [];

    const current = state.players[state.currentPlayerIndex];
    if (!current || current.playerId !== playerId) return [];

    const toCall = state.currentBet - ps.bet;
    const actions: GameActionPayload[] = [{ type: "fold" }];

    if (toCall === 0) {
      actions.push({ type: "check" });
    } else {
      actions.push({ type: "call", amount: toCall });
    }

    actions.push({ type: "raise", min: state.currentBet + state.bigBlind });
    actions.push({ type: "all-in" });

    return actions;
  },

  applyAction(state, playerId, action) {
    if (action.type === "startHand") {
      if (state.phase !== "waiting" && state.phase !== "roundEnd" && state.phase !== "showdown") {
        return state;
      }
      const newDealer = (state.dealerIndex + 1) % state.players.length;
      const fresh = this.createInitialState(
        state.players.map((p) => ({
          id: p.playerId,
          name: "",
          chips: STARTING_CHIPS,
          isHost: false,
          isConnected: true,
          joinedAt: 0,
        }))
      );
      return dealHoleCards({ ...fresh, dealerIndex: newDealer }, []);
    }

    const ps = state.players.find((p) => p.playerId === playerId);
    if (!ps || state.players[state.currentPlayerIndex]?.playerId !== playerId) return state;

    const actionType = action.type as PokerActionType;
    let newState = { ...state };
    let players = [...state.players];
    const idx = players.findIndex((p) => p.playerId === playerId);

    if (actionType === "fold") {
      players[idx] = { ...players[idx], folded: true, lastAction: "fold" };
    } else if (actionType === "check") {
      players[idx] = { ...players[idx], lastAction: "check" };
    } else if (actionType === "call") {
      const toCall = state.currentBet - ps.bet;
      players[idx] = {
        ...players[idx],
        bet: ps.bet + toCall,
        totalBet: ps.totalBet + toCall,
        lastAction: "call",
        allIn: toCall >= STARTING_CHIPS,
      };
      newState = { ...newState, pot: state.pot + toCall };
    } else if (actionType === "raise") {
      const amount = (action.amount as number) ?? state.currentBet + state.bigBlind;
      const raiseBy = amount - ps.bet;
      players[idx] = {
        ...players[idx],
        bet: amount,
        totalBet: ps.totalBet + raiseBy,
        lastAction: "raise",
        allIn: raiseBy >= STARTING_CHIPS,
      };
      newState = { ...newState, pot: state.pot + raiseBy, currentBet: amount };
    } else if (actionType === "all-in") {
      const allIn = STARTING_CHIPS;
      players[idx] = {
        ...players[idx],
        bet: ps.bet + allIn,
        totalBet: ps.totalBet + allIn,
        lastAction: "all-in",
        allIn: true,
      };
      const newBet = ps.bet + allIn;
      newState = {
        ...newState,
        pot: state.pot + allIn,
        currentBet: Math.max(state.currentBet, newBet),
      };
    }

    newState = { ...newState, players };
    const nextIdx = nextPlayerIndex(newState, state.currentPlayerIndex);
    newState = { ...newState, currentPlayerIndex: nextIdx };

    if (isBettingRoundComplete(newState)) {
      return advancePhase(newState, []);
    }

    return newState;
  },

  isRoundOver(state) {
    return state.phase === "roundEnd" || state.phase === "showdown";
  },

  getPublicState(state, viewerId) {
    const hideHole = !["showdown", "roundEnd"].includes(state.phase);
    return {
      ...state,
      players: state.players.map((ps) => ({
        ...ps,
        holeCards: ps.holeCards.map((c) =>
          hideHole && ps.playerId !== viewerId ? { ...c, hidden: true } : c
        ),
      })),
    };
  },
};
