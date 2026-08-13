import { createDeck, drawCards, shuffleDeck } from "../../lib/deck";
import type {
  GameActionPayload,
  Player,
  PokerActionType,
  PokerPlayerState,
  PokerPot,
  PokerState,
} from "../../types";
import type { GameEngine } from "../engine";
import { compareHands, evaluateHand } from "./hand-evaluator";

const SMALL_BLIND = 10;
const BIG_BLIND = 20;
export const POKER_TURN_MS = 30_000;
const BETTING_PHASES = new Set(["preflop", "flop", "turn", "river"]);

function activePlayers(state: PokerState): PokerPlayerState[] {
  return state.players.filter((player) => !player.folded);
}

function nextMatchingIndex(
  players: PokerPlayerState[],
  from: number,
  predicate: (player: PokerPlayerState) => boolean
): number {
  for (let offset = 1; offset <= players.length; offset += 1) {
    const index = (from + offset) % players.length;
    if (predicate(players[index])) return index;
  }
  return from;
}

function actionable(player: PokerPlayerState): boolean {
  return !player.folded && !player.allIn && player.stack > 0;
}

function nextActorIndex(state: PokerState, from: number): number {
  return nextMatchingIndex(
    state.players,
    from,
    (player) => actionable(player) && (!player.acted || player.bet < state.currentBet)
  );
}

function withTurnClock<T extends PokerState>(state: T): T {
  const now = Date.now();
  return { ...state, turnStartedAt: now, turnDeadlineAt: now + POKER_TURN_MS };
}

function postBlind(player: PokerPlayerState, blind: number): PokerPlayerState {
  const amount = Math.min(player.stack, blind);
  return {
    ...player,
    stack: player.stack - amount,
    bet: amount,
    totalBet: amount,
    allIn: player.stack === amount,
    lastAction: "call",
  };
}

export function buildPokerPots(players: PokerPlayerState[]): PokerPot[] {
  const levels = [...new Set(players.map((player) => player.totalBet).filter(Boolean))]
    .sort((a, b) => a - b);
  const pots: PokerPot[] = [];
  let previous = 0;

  for (const level of levels) {
    const contributors = players.filter((player) => player.totalBet >= level);
    const amount = (level - previous) * contributors.length;
    if (amount > 0) {
      pots.push({
        amount,
        eligiblePlayerIds: contributors
          .filter((player) => !player.folded)
          .map((player) => player.playerId),
      });
    }
    previous = level;
  }
  return pots;
}

function beginHand(state: PokerState): PokerState {
  const playable = state.players.filter((player) => player.stack > 0);
  if (playable.length < 2) return state;

  let deck = shuffleDeck(createDeck());
  const players: PokerPlayerState[] = playable.map((player) => {
    const { drawn, remaining } = drawCards(deck, 2);
    deck = remaining;
    return {
      ...player,
      holeCards: drawn,
      bet: 0,
      totalBet: 0,
      folded: false,
      allIn: false,
      lastAction: null,
      acted: false,
    };
  });
  const previousDealerId = state.players[state.dealerIndex]?.playerId;
  const previousDealer = Math.max(
    -1,
    players.findIndex((player) => player.playerId === previousDealerId)
  );
  const dealerIndex = (previousDealer + 1 + players.length) % players.length;
  const smallBlindIndex =
    players.length === 2
      ? dealerIndex
      : nextMatchingIndex(players, dealerIndex, () => true);
  const bigBlindIndex = nextMatchingIndex(players, smallBlindIndex, () => true);
  players[smallBlindIndex] = postBlind(players[smallBlindIndex], SMALL_BLIND);
  players[bigBlindIndex] = postBlind(players[bigBlindIndex], BIG_BLIND);

  const firstToAct =
    players.length === 2
      ? smallBlindIndex
      : nextMatchingIndex(players, bigBlindIndex, actionable);
  const currentBet = Math.max(BIG_BLIND, ...players.map((player) => player.bet));
  const next = withTurnClock({
    ...state,
    deck,
    players,
    phase: "preflop" as const,
    communityCards: [],
    pot: players.reduce((sum, player) => sum + player.totalBet, 0),
    pots: buildPokerPots(players),
    currentBet,
    currentPlayerIndex: firstToAct,
    dealerIndex,
    smallBlindIndex,
    bigBlindIndex,
    lastFullRaise: BIG_BLIND,
    winners: [],
    winnersPaid: false,
    message: "Pre-flop",
    dealerMessage: "Cartas y ciegas repartidas.",
    dealStartedAt: Date.now(),
    dealCardCount: players.length * 2,
    dealSlots: undefined,
  });
  return shouldAutoRunout(next) ? runoutToShowdown(next) : next;
}

function isRoundComplete(state: PokerState): boolean {
  return activePlayers(state).every(
    (player) => player.allIn || (player.acted && player.bet === state.currentBet)
  );
}

function shouldAutoRunout(state: PokerState): boolean {
  return activePlayers(state).filter(actionable).length <= 1;
}

function awardUncontested(state: PokerState): PokerState {
  const winner = activePlayers(state)[0];
  const players = state.players.map((player) =>
    player.playerId === winner.playerId
      ? { ...player, stack: player.stack + state.pot }
      : player
  );
  return {
    ...state,
    players,
    pots: buildPokerPots(players),
    phase: "roundEnd",
    winners: [{ playerId: winner.playerId, amount: state.pot, hand: "Último en la mano" }],
    winnersPaid: false,
    turnStartedAt: undefined,
    turnDeadlineAt: undefined,
    dealStartedAt: undefined,
    dealCardCount: undefined,
    dealSlots: undefined,
    message: "Mano ganada por retirada",
    dealerMessage: "El bote se entrega al último jugador activo.",
  };
}

function firstPostflopActor(state: PokerState, players: PokerPlayerState[]): number {
  return nextMatchingIndex(players, state.dealerIndex, actionable);
}

function dealNextStreet(state: PokerState): PokerState {
  const players = state.players.map((player) => ({
    ...player,
    bet: 0,
    acted: false,
    lastAction: null,
  }));
  let deck = state.deck;
  let communityCards = state.communityCards;
  let phase: PokerState["phase"];
  let count: number;

  if (state.phase === "preflop") {
    const draw = drawCards(deck, 3);
    deck = draw.remaining;
    communityCards = draw.drawn;
    phase = "flop";
    count = 3;
  } else if (state.phase === "flop") {
    const draw = drawCards(deck, 1);
    deck = draw.remaining;
    communityCards = [...communityCards, ...draw.drawn];
    phase = "turn";
    count = 1;
  } else if (state.phase === "turn") {
    const draw = drawCards(deck, 1);
    deck = draw.remaining;
    communityCards = [...communityCards, ...draw.drawn];
    phase = "river";
    count = 1;
  } else {
    return settlePokerShowdown(state);
  }

  const next = withTurnClock({
    ...state,
    players,
    deck,
    communityCards,
    phase,
    currentBet: 0,
    currentPlayerIndex: firstPostflopActor(state, players),
    lastFullRaise: state.bigBlind,
    message: `${phase[0].toUpperCase()}${phase.slice(1)}`,
    dealerMessage: "Cartas comunitarias repartidas.",
    dealStartedAt: Date.now(),
    dealCardCount: count,
    dealSlots: ["community"],
  });
  return shouldAutoRunout(next) ? runoutToShowdown(next) : next;
}

function runoutToShowdown(state: PokerState): PokerState {
  const needed = Math.max(0, 5 - state.communityCards.length);
  const draw = drawCards(state.deck, needed);
  return settlePokerShowdown({
    ...state,
    phase: "river",
    deck: draw.remaining,
    communityCards: [...state.communityCards, ...draw.drawn],
    dealStartedAt: Date.now(),
    dealCardCount: needed,
    dealSlots: needed > 0 ? ["community"] : undefined,
  });
}

function winnerOrder(state: PokerState, ids: string[]): string[] {
  const ordered: string[] = [];
  for (let offset = 1; offset <= state.players.length; offset += 1) {
    const id = state.players[(state.dealerIndex + offset) % state.players.length].playerId;
    if (ids.includes(id)) ordered.push(id);
  }
  return ordered;
}

export function settlePokerShowdown(state: PokerState): PokerState {
  const pots = buildPokerPots(state.players);
  const payouts = new Map<string, { amount: number; hand: string }>();

  for (const pot of pots) {
    const evaluations = pot.eligiblePlayerIds.map((playerId) => {
      const player = state.players.find((candidate) => candidate.playerId === playerId)!;
      return { playerId, evaluation: evaluateHand(player.holeCards, state.communityCards) };
    });
    evaluations.sort((a, b) => compareHands(b.evaluation, a.evaluation));
    const best = evaluations[0]?.evaluation;
    if (!best) continue;
    const tied = evaluations
      .filter((entry) => compareHands(entry.evaluation, best) === 0)
      .map((entry) => entry.playerId);
    const share = Math.floor(pot.amount / tied.length);
    let remainder = pot.amount % tied.length;
    for (const playerId of winnerOrder(state, tied)) {
      const previous = payouts.get(playerId) ?? { amount: 0, hand: best.name };
      payouts.set(playerId, {
        hand: best.name,
        amount: previous.amount + share + (remainder-- > 0 ? 1 : 0),
      });
    }
  }

  const players = state.players.map((player) => ({
    ...player,
    stack: player.stack + (payouts.get(player.playerId)?.amount ?? 0),
  }));
  const winners = [...payouts].map(([playerId, result]) => ({ playerId, ...result }));
  return {
    ...state,
    players,
    pots,
    phase: "showdown",
    winners,
    winnersPaid: false,
    turnStartedAt: undefined,
    turnDeadlineAt: undefined,
    message: winners.length === 1 ? "Ganador del showdown" : "Bote repartido",
    dealerMessage: "Showdown completado.",
  };
}

function contribute(
  player: PokerPlayerState,
  amount: number,
  action: PokerActionType
): PokerPlayerState {
  const contribution = Math.max(0, Math.min(player.stack, amount));
  return {
    ...player,
    stack: player.stack - contribution,
    bet: player.bet + contribution,
    totalBet: player.totalBet + contribution,
    allIn: player.stack === contribution,
    acted: true,
    lastAction: action,
  };
}

export function validatePokerAction(
  state: PokerState,
  playerId: string,
  action: GameActionPayload
): string | null {
  const player = state.players.find((candidate) => candidate.playerId === playerId);
  if (!player || state.players[state.currentPlayerIndex]?.playerId !== playerId) {
    return "No es tu turno";
  }
  if (action.type === "check" && state.currentBet !== player.bet) {
    return "No puedes pasar: hay una apuesta pendiente";
  }
  if (action.type === "raise") {
    const amount = Number(action.amount);
    const minimum = state.currentBet + state.lastFullRaise;
    const maximum = player.bet + player.stack;
    if (!Number.isFinite(amount) || amount < minimum || amount > maximum) {
      return `La subida debe estar entre ${minimum} y ${maximum}`;
    }
  }
  return null;
}

function applyBettingAction(
  state: PokerState,
  playerId: string,
  action: GameActionPayload
): PokerState {
  const error = validatePokerAction(state, playerId, action);
  if (error) return state;
  const index = state.players.findIndex((player) => player.playerId === playerId);
  const current = state.players[index];
  let players = state.players.map((player) => ({ ...player }));
  let currentBet = state.currentBet;
  let lastFullRaise = state.lastFullRaise;
  const actionType = action.type as PokerActionType;

  if (actionType === "fold") {
    players[index] = { ...current, folded: true, acted: true, lastAction: "fold" };
  } else if (actionType === "check") {
    players[index] = { ...current, acted: true, lastAction: "check" };
  } else if (actionType === "call") {
    players[index] = contribute(current, currentBet - current.bet, "call");
  } else {
    const target =
      actionType === "all-in"
        ? current.bet + current.stack
        : Number(action.amount);
    const raiseSize = target - currentBet;
    const isFullRaise = target > currentBet && raiseSize >= lastFullRaise;
    if (isFullRaise) {
      players = players.map((player, playerIndex) =>
        playerIndex !== index && actionable(player) ? { ...player, acted: false } : player
      );
      lastFullRaise = raiseSize;
    }
    players[index] = contribute(
      current,
      target - current.bet,
      actionType === "all-in" ? "all-in" : "raise"
    );
    currentBet = Math.max(currentBet, target);
  }

  let next: PokerState = {
    ...state,
    players,
    currentBet,
    lastFullRaise,
    pot: players.reduce((sum, player) => sum + player.totalBet, 0),
    pots: buildPokerPots(players),
  };
  if (activePlayers(next).length === 1) return awardUncontested(next);
  if (isRoundComplete(next)) return dealNextStreet(next);
  next = { ...next, currentPlayerIndex: nextActorIndex(next, index) };
  return withTurnClock(next);
}

export function applyPokerTimeout(state: PokerState, now = Date.now()): PokerState {
  if (!BETTING_PHASES.has(state.phase) || !state.turnDeadlineAt || now < state.turnDeadlineAt) {
    return state;
  }
  const player = state.players[state.currentPlayerIndex];
  if (!player) return state;
  return applyBettingAction(
    state,
    player.playerId,
    { type: player.bet === state.currentBet ? "check" : "fold" }
  );
}

export const pokerEngine: GameEngine<PokerState> = {
  id: "poker",
  name: "Texas Hold'em",
  description: "Texas Hold'em multijugador de 2 a 8 jugadores.",
  minPlayers: 2,
  maxPlayers: 8,
  icon: "spade",

  createInitialState(players: Player[]): PokerState {
    const pokerPlayers = players
      .filter((player) => player.chips > 0)
      .map((player) => ({
        playerId: player.id,
        holeCards: [],
        bet: 0,
        totalBet: 0,
        folded: false,
        allIn: false,
        lastAction: null,
        stack: player.chips,
        acted: false,
      }));
    return {
      type: "poker",
      phase: "waiting",
      deck: [],
      communityCards: [],
      players: pokerPlayers,
      pot: 0,
      pots: [],
      currentBet: 0,
      currentPlayerIndex: 0,
      dealerIndex: Math.max(0, pokerPlayers.length - 1),
      smallBlindIndex: 0,
      bigBlindIndex: 0,
      smallBlind: SMALL_BLIND,
      bigBlind: BIG_BLIND,
      lastFullRaise: BIG_BLIND,
      winners: [],
      message: "Mesa preparada",
      dealerMessage: "Esperando el inicio de la mano.",
    };
  },

  getValidActions(state, playerId) {
    const player = state.players.find((candidate) => candidate.playerId === playerId);
    if (!player) return [];
    if (["waiting", "roundEnd", "showdown"].includes(state.phase)) {
      return player.stack > 0 ? [{ type: "startHand" }] : [];
    }
    if (!BETTING_PHASES.has(state.phase) || state.players[state.currentPlayerIndex]?.playerId !== playerId) {
      return [];
    }

    const toCall = state.currentBet - player.bet;
    const actions: GameActionPayload[] = [{ type: "fold" }];
    actions.push(toCall === 0
      ? { type: "check" }
      : { type: "call", amount: Math.min(toCall, player.stack) });
    if (player.stack > toCall) {
      const minimum = state.currentBet + state.lastFullRaise;
      const maximum = player.bet + player.stack;
      if (maximum >= minimum) actions.push({ type: "raise", min: minimum, max: maximum });
    }
    if (player.stack > 0) actions.push({ type: "all-in", amount: player.stack });
    return actions;
  },

  applyAction(state, playerId, action) {
    if (action.type === "startHand") {
      if (!["waiting", "roundEnd", "showdown"].includes(state.phase)) return state;
      return beginHand(state);
    }
    if (!this.getValidActions(state, playerId).some((valid) => valid.type === action.type)) {
      return state;
    }
    return applyBettingAction(state, playerId, action);
  },

  isRoundOver(state) {
    return state.phase === "roundEnd" || state.phase === "showdown";
  },

  getPublicState(state, viewerId) {
    const hideHole = !["showdown", "roundEnd"].includes(state.phase);
    return {
      ...state,
      deck: [],
      players: state.players.map((player) => ({
        ...player,
        holeCards: player.holeCards.map((card) =>
          hideHole && player.playerId !== viewerId ? { ...card, hidden: true } : card
        ),
      })),
    };
  },
};
