import {
  createDeck,
  drawCards,
  handTotalAll,
  isBlackjack,
  dealerUpcardNeedsPeek,
  shuffleDeck,
  splitValue,
} from "../../lib/deck";
import type {
  BlackjackHand,
  BlackjackPlayerState,
  BlackjackState,
  Card,
  GameActionPayload,
  Player,
} from "../../types";
import type { GameEngine } from "../engine";

const MIN_BET = 10;
const NUM_DECKS = 6;

function emptyHand(bet = 0): BlackjackHand {
  return { cards: [], bet, status: "active" };
}

function createPlayerState(playerId: string): BlackjackPlayerState {
  return { playerId, hands: [emptyHand()], currentHandIndex: 0 };
}

function revealDealer(hand: Card[]): Card[] {
  return hand.map((c) => ({ ...c, hidden: false }));
}

function canSplitHand(hand: BlackjackHand, ps: BlackjackPlayerState): boolean {
  if (hand.cards.length !== 2 || hand.status !== "active") return false;
  if (ps.hands.length >= 2) return false;
  if (hand.fromSplit) return false;
  const [a, b] = hand.cards;
  return splitValue(a.rank) === splitValue(b.rank);
}

/** Reparto estándar: P↑, D↑, P↑, D↓ (hole) por jugador en orden */
function dealInitialCards(state: BlackjackState): BlackjackState {
  let deck = [...state.deck];
  const playerStates = state.players.map((p) => ({
    ...p,
    hands: [{ ...emptyHand(p.hands[0]?.bet ?? 0), status: "active" as const }],
    currentHandIndex: 0,
  }));
  const dealerHand: Card[] = [];

  // Ronda 1: una carta boca arriba por jugador
  for (let i = 0; i < playerStates.length; i++) {
    const { drawn, remaining } = drawCards(deck, 1);
    deck = remaining;
    playerStates[i].hands[0].cards.push(drawn[0]);
  }

  // Crupier carta boca arriba
  {
    const { drawn, remaining } = drawCards(deck, 1);
    deck = remaining;
    dealerHand.push({ ...drawn[0], hidden: false });
  }

  // Ronda 2: segunda carta por jugador
  for (let i = 0; i < playerStates.length; i++) {
    const { drawn, remaining } = drawCards(deck, 1);
    deck = remaining;
    playerStates[i].hands[0].cards.push(drawn[0]);
  }

  // Crupier hole card (boca abajo)
  {
    const { drawn, remaining } = drawCards(deck, 1);
    deck = remaining;
    dealerHand.push({ ...drawn[0], hidden: true });
  }

  return resolveNaturals({
    ...state,
    deck,
    dealerHand,
    players: playerStates,
    phase: "dealing",
    dealerMessage: "Cartas repartidas — verificando naturals...",
  });
}

/** Fase 2: verificación de Blackjack natural y peek del crupier */
function resolveNaturals(state: BlackjackState): BlackjackState {
  const dealerUp = state.dealerHand[0];
  const dealerFull = revealDealer(state.dealerHand);
  const dealerHasBJ = isBlackjack(dealerFull);
  const needsPeek = dealerUpcardNeedsPeek(dealerUp);

  let players = state.players.map((ps) => {
    const hand = ps.hands[0];
    const playerBJ = isBlackjack(hand.cards);

    if (playerBJ) {
      if (needsPeek && dealerHasBJ) {
        return { ...ps, hands: [{ ...hand, status: "push" as const }] };
      }
      if (needsPeek && !dealerHasBJ) {
        return { ...ps, hands: [{ ...hand, status: "blackjack" as const }] };
      }
      // Crupier no muestra As/10 — jugador gana natural inmediato
      return { ...ps, hands: [{ ...hand, status: "blackjack" as const }] };
    }

    // Sin BJ jugador: si crupier tiene BJ en peek, pierde
    if (needsPeek && dealerHasBJ) {
      return { ...ps, hands: [{ ...hand, status: "lost" as const }] };
    }

    return ps;
  });

  // Crupier tiene BJ — fin de ronda
  if (needsPeek && dealerHasBJ) {
    return finalizeRound({
      ...state,
      players,
      dealerHand: dealerFull,
      phase: "roundEnd",
      message: "¡Blackjack del crupier! Ronda terminada.",
      dealerMessage: `Crupier: Blackjack natural (${dealerUp.rank} + hole).`,
    });
  }

  // ¿Quedan manos activas para jugar?
  const first = findNextActiveHand(players, 0, 0);
  if (!first) {
    // Solo naturals resueltos
    return finalizeRound({
      ...state,
      players,
      dealerHand: state.dealerHand,
      phase: "roundEnd",
      message: "Ronda terminada.",
      dealerMessage: "Todos los resultados resueltos por naturals.",
    });
  }

  return {
    ...state,
    players,
    currentPlayerIndex: first.playerIndex,
    phase: "playerTurn",
    message: "Tu turno — Pedir, Plantarse, Doblar, Dividir o Rendirse",
    dealerMessage: needsPeek
      ? "Peek: crupier sin Blackjack. Turno de jugadores."
      : "Turno de jugadores.",
  };
}

function findNextActiveHand(
  players: BlackjackPlayerState[],
  startPlayer: number,
  startHand: number
): { playerIndex: number; handIndex: number } | null {
  for (let pi = startPlayer; pi < players.length; pi++) {
    const ps = players[pi];
    const hi = pi === startPlayer ? startHand : 0;
    for (let h = hi; h < ps.hands.length; h++) {
      if (ps.hands[h].status === "active") {
        return { playerIndex: pi, handIndex: h };
      }
    }
  }
  return null;
}

function getCurrentHand(state: BlackjackState): {
  ps: BlackjackPlayerState;
  hand: BlackjackHand;
  handIdx: number;
} | null {
  const ps = state.players[state.currentPlayerIndex];
  if (!ps) return null;
  const handIdx = ps.currentHandIndex;
  const hand = ps.hands[handIdx];
  if (!hand) return null;
  return { ps, hand, handIdx };
}

function advanceTurn(state: BlackjackState): BlackjackState {
  const cur = getCurrentHand(state);
  if (!cur) return startDealerPhase(state);

  const { handIdx } = cur;
  const pi = state.currentPlayerIndex;

  // Siguiente mano del mismo jugador (split)
  const nextHand = findNextActiveHand(state.players, pi, handIdx + 1);
  if (nextHand && nextHand.playerIndex === pi) {
    const players = state.players.map((p, i) =>
      i === pi ? { ...p, currentHandIndex: nextHand.handIndex } : p
    );
    return {
      ...state,
      players,
      message: `Mano ${nextHand.handIndex + 1} — tu turno`,
    };
  }

  // Siguiente jugador
  const next = findNextActiveHand(state.players, pi + 1, 0);
  if (next) {
    const players = state.players.map((p, i) =>
      i === next.playerIndex ? { ...p, currentHandIndex: next.handIndex } : p
    );
    return {
      ...state,
      players,
      currentPlayerIndex: next.playerIndex,
      message: "Turno del siguiente jugador",
    };
  }

  return startDealerPhase(state);
}

function startDealerPhase(state: BlackjackState): BlackjackState {
  const dealerNeeded = state.players.some((ps) =>
    ps.hands.some((h) => h.status === "stood")
  );

  if (!dealerNeeded) {
    return finalizeRound({
      ...state,
      dealerHand: revealDealer(state.dealerHand),
      phase: "roundEnd",
      message: "Ronda terminada.",
      dealerMessage: "Crupier no juega — ningún jugador en pie.",
    });
  }

  return dealerPlay({
    ...state,
    phase: "dealerTurn",
    message: "Turno del crupier (CPU)...",
    dealerMessage: "Revelando carta oculta...",
  });
}

function dealerPlay(state: BlackjackState): BlackjackState {
  let dealerHand = revealDealer(state.dealerHand);
  let deck = [...state.deck];

  // Regla: pedir con 16 o menos, plantarse con 17+ (incl. soft 17)
  while (handTotalAll(dealerHand) < 17) {
    const { drawn, remaining } = drawCards(deck, 1);
    dealerHand = [...dealerHand, ...drawn];
    deck = remaining;
  }

  return resolveAgainstDealer({
    ...state,
    dealerHand,
    deck,
  });
}

function resolveAgainstDealer(state: BlackjackState): BlackjackState {
  const dealerTotal = handTotalAll(state.dealerHand);
  const dealerBusted = dealerTotal > 21;
  const dealerHasBJ = isBlackjack(state.dealerHand);

  const players = state.players.map((ps) => ({
    ...ps,
    hands: ps.hands.map((hand) => {
      if (["busted", "surrendered", "lost", "won", "push", "blackjack"].includes(hand.status)) {
        return hand;
      }

      const playerTotal = handTotalAll(hand.cards);
      let status = hand.status;

      if (status === "stood" || status === "active") {
        if (dealerBusted) status = "won";
        else if (dealerHasBJ) status = "lost";
        else if (playerTotal > dealerTotal) status = "won";
        else if (playerTotal < dealerTotal) status = "lost";
        else status = "push";
      }

      return { ...hand, status };
    }),
  }));

  return finalizeRound({
    ...state,
    players,
    phase: "roundEnd",
    message: "Ronda terminada. Pulsa Nueva Ronda.",
    dealerMessage: `Crupier: ${dealerTotal}${dealerBusted ? " — ¡Se pasó!" : ""}`,
  });
}

function finalizeRound(state: BlackjackState): BlackjackState {
  return { ...state, dealerHand: revealDealer(state.dealerHand) };
}

function updatePlayerHand(
  players: BlackjackPlayerState[],
  playerId: string,
  handIdx: number,
  updater: (h: BlackjackHand) => BlackjackHand
): BlackjackPlayerState[] {
  return players.map((p) => {
    if (p.playerId !== playerId) return p;
    const hands = [...p.hands];
    hands[handIdx] = updater(hands[handIdx]);
    return { ...p, hands };
  });
}

export const blackjackEngine: GameEngine<BlackjackState> = {
  id: "blackjack",
  name: "Blackjack",
  description: "21 contra el crupier CPU — reglas de casino estándar",
  minPlayers: 1,
  maxPlayers: 6,
  icon: "🃏",

  createInitialState(players: Player[]): BlackjackState {
    return {
      type: "blackjack",
      phase: "betting",
      deck: shuffleDeck(createDeck(NUM_DECKS)),
      dealerHand: [],
      players: players.map((p) => createPlayerState(p.id)),
      currentPlayerIndex: 0,
      minBet: MIN_BET,
      blackjackPayout: "3:2",
      allowSurrender: true,
      message: `Apuesta mínima $${MIN_BET}. Todos deben apostar para repartir.`,
      dealerMessage: "CPU Crupier listo.",
    };
  },

  getValidActions(state, playerId) {
    const ps = state.players.find((p) => p.playerId === playerId);
    if (!ps) return [];

    if (state.phase === "betting") {
      return [{ type: "bet", min: MIN_BET }];
    }
    if (state.phase === "roundEnd") {
      return [{ type: "newRound" }];
    }
    if (state.phase !== "playerTurn") return [];

    const cur = getCurrentHand(state);
    if (!cur || cur.ps.playerId !== playerId) return [];

    const { hand, handIdx } = cur;
    if (hand.status !== "active") return [];

    const actions: GameActionPayload[] = [
      { type: "hit" },
      { type: "stand" },
    ];

    // Doblar: solo con 2 cartas iniciales de la mano
    if (hand.cards.length === 2) {
      actions.push({ type: "double" });
    }

    // Split: par del mismo valor, una sola división
    if (canSplitHand(hand, cur.ps)) {
      actions.push({ type: "split" });
    }

    // Rendirse: 2 cartas, mano original, mesa lo permite
    if (
      state.allowSurrender &&
      hand.cards.length === 2 &&
      !hand.fromSplit &&
      cur.ps.hands.length === 1
    ) {
      actions.push({ type: "surrender" });
    }

    return actions;
  },

  applyAction(state, playerId, action) {
    // ── Apuesta ──
    if (action.type === "bet") {
      const amount = action.amount as number;
      const ps = state.players.find((p) => p.playerId === playerId);
      if (!ps || state.phase !== "betting" || amount < MIN_BET) return state;

      const updatedPlayers = state.players.map((p) => {
        if (p.playerId !== playerId) return p;
        return {
          ...p,
          hands: [{ ...emptyHand(amount), status: "active" as const }],
        };
      });

      const allBet = updatedPlayers.every((p) => p.hands[0].bet >= MIN_BET);
      if (!allBet) {
        return {
          ...state,
          players: updatedPlayers,
          message: "Esperando apuestas de todos los jugadores...",
        };
      }

      // Paso 1.2: barajar shoe nuevo cada ronda
      const freshDeck = shuffleDeck(createDeck(NUM_DECKS));
      return dealInitialCards({
        ...state,
        deck: freshDeck,
        players: updatedPlayers,
      });
    }

    if (action.type === "newRound") {
      return {
        ...this.createInitialState(
          state.players.map((p) => ({
            id: p.playerId,
            name: "",
            chips: 0,
            isHost: false,
            isConnected: true,
            joinedAt: 0,
          }))
        ),
        // chips se preservan en room-service
      };
    }

    if (state.phase !== "playerTurn") return state;
    const cur = getCurrentHand(state);
    if (!cur || cur.ps.playerId !== playerId) return state;

    const { handIdx, hand } = cur;

    // ── Pedir (Hit) ──
    if (action.type === "hit") {
      const { drawn, remaining } = drawCards(state.deck, 1);
      const newCards = [...hand.cards, ...drawn];
      const total = handTotalAll(newCards);
      const newStatus = total > 21 ? ("busted" as const) : ("active" as const);

      let players = updatePlayerHand(state.players, playerId, handIdx, (h) => ({
        ...h,
        cards: newCards,
        status: newStatus,
      }));

      let newState = { ...state, deck: remaining, players };

      if (newStatus === "busted") {
        newState = advanceTurn(newState);
        if (newState.phase === "dealerTurn") return dealerPlay(newState);
      }
      return newState;
    }

    // ── Plantarse (Stand) ──
    if (action.type === "stand") {
      let players = updatePlayerHand(state.players, playerId, handIdx, (h) => ({
        ...h,
        status: "stood",
      }));
      let newState = advanceTurn({ ...state, players });
      if (newState.phase === "dealerTurn") return dealerPlay(newState);
      return newState;
    }

    // ── Doblar (Double Down) ──
    if (action.type === "double") {
      if (hand.cards.length !== 2) return state;
      const { drawn, remaining } = drawCards(state.deck, 1);
      const newCards = [...hand.cards, ...drawn];
      const total = handTotalAll(newCards);
      const newStatus = total > 21 ? ("busted" as const) : ("stood" as const);

      let players = updatePlayerHand(state.players, playerId, handIdx, (h) => ({
        ...h,
        cards: newCards,
        bet: h.bet * 2,
        status: newStatus,
      }));

      let newState = advanceTurn({ ...state, deck: remaining, players });
      if (newState.phase === "dealerTurn") return dealerPlay(newState);
      return newState;
    }

    // ── Dividir (Split) ──
    if (action.type === "split") {
      if (!canSplitHand(hand, cur.ps)) return state;

      const [c1, c2] = hand.cards;
      let deck = [...state.deck];

      const { drawn: d1, remaining: r1 } = drawCards(deck, 1);
      deck = r1;
      const { drawn: d2, remaining: r2 } = drawCards(deck, 1);
      deck = r2;

      const hand0: BlackjackHand = {
        cards: [c1, d1[0]],
        bet: hand.bet,
        status: "active",
      };
      const hand1: BlackjackHand = {
        cards: [c2, d2[0]],
        bet: hand.bet,
        status: "active",
        fromSplit: true,
      };

      // Blackjack post-split = 21, no natural 3:2
      if (handTotalAll(hand0.cards) === 21) hand0.status = "stood";
      if (handTotalAll(hand1.cards) === 21) hand1.status = "stood";

      const players = state.players.map((p) => {
        if (p.playerId !== playerId) return p;
        return { ...p, hands: [hand0, hand1], currentHandIndex: 0 };
      });

      let newState: BlackjackState = {
        ...state,
        deck,
        players,
        message: "Manos divididas — juega mano 1",
      };

      // Si ambas manos auto-stand (21), avanzar
      if (hand0.status === "stood" && hand1.status === "stood") {
        newState = advanceTurn(newState);
        if (newState.phase === "dealerTurn") return dealerPlay(newState);
      }
      return newState;
    }

    // ── Rendirse (Surrender) ──
    if (action.type === "surrender") {
      if (!state.allowSurrender || hand.cards.length !== 2 || cur.ps.hands.length > 1) {
        return state;
      }

      let players = updatePlayerHand(state.players, playerId, handIdx, (h) => ({
        ...h,
        status: "surrendered",
      }));

      let newState = advanceTurn({ ...state, players });
      if (newState.phase === "dealerTurn") return dealerPlay(newState);
      return newState;
    }

    return state;
  },

  isRoundOver(state) {
    return state.phase === "roundEnd";
  },

  getPublicState(state, viewerId) {
    const hideHole =
      state.phase === "playerTurn" ||
      state.phase === "betting" ||
      state.phase === "dealing";

    return {
      ...state,
      dealerHand: state.dealerHand.map((c, i) => {
        // Hole card = segunda carta (índice 1)
        if (hideHole && i === 1) return { ...c, hidden: true };
        return { ...c, hidden: false };
      }),
      players: state.players.map((ps) => ({
        ...ps,
        hands: ps.hands.map((h) => ({
          ...h,
          cards:
            ps.playerId !== viewerId && state.phase !== "roundEnd"
              ? h.cards.map((c) => ({ ...c, hidden: true }))
              : h.cards.map((c) => ({ ...c, hidden: false })),
        })),
      })),
    };
  },
};
