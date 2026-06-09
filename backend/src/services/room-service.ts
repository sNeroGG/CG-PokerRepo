import { getEngine } from "../games/registry";
import { generateRoomCode, getRoom, saveRoom } from "./store";
import type {
  BlackjackState,
  GameActionPayload,
  GameType,
  Player,
  PokerState,
  Room,
} from "../types";

const STARTING_CHIPS = 1000;

function syncBlackjackPayouts(room: Room): void {
  const state = room.gameState as BlackjackState;
  if (state.phase !== "roundEnd") return;

  const bjMult = state.blackjackPayout === "6:5" ? 2.2 : 2.5;

  for (const ps of state.players) {
    const player = room.players.find((p) => p.id === ps.playerId);
    if (!player) continue;

    for (const hand of ps.hands) {
      if (hand.payoutDone) continue;

      switch (hand.status) {
        case "blackjack":
          player.chips += Math.floor(hand.bet * bjMult);
          break;
        case "won":
          player.chips += hand.bet * 2;
          break;
        case "push":
          player.chips += hand.bet;
          break;
        case "surrendered":
          player.chips += Math.floor(hand.bet * 0.5);
          break;
        default:
          break;
      }
      hand.payoutDone = true;
    }
  }
}

export async function createRoom(hostName: string, hostId: string): Promise<Room> {
  let code = generateRoomCode();
  while (await getRoom(code)) code = generateRoomCode();

  const host: Player = {
    id: hostId,
    name: hostName,
    chips: STARTING_CHIPS,
    isHost: true,
    isConnected: true,
    joinedAt: Date.now(),
  };

  const room: Room = {
    code,
    hostId,
    gameType: null,
    status: "lobby",
    players: [host],
    gameState: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await saveRoom(room);
  return room;
}

export async function joinRoom(
  code: string,
  playerName: string,
  playerId: string
): Promise<{ room: Room } | { error: string }> {
  const room = await getRoom(code);
  if (!room) return { error: "Sala no encontrada" };
  if (room.status !== "lobby") return { error: "La partida ya comenzó" };

  const existing = room.players.find((p) => p.id === playerId);
  if (existing) {
    existing.isConnected = true;
    existing.name = playerName;
    await saveRoom(room);
    return { room };
  }

  if (room.players.length >= 6) return { error: "Sala llena (máx. 6 jugadores)" };

  room.players.push({
    id: playerId,
    name: playerName,
    chips: STARTING_CHIPS,
    isHost: false,
    isConnected: true,
    joinedAt: Date.now(),
  });

  await saveRoom(room);
  return { room };
}

export async function setGameType(
  code: string,
  hostId: string,
  gameType: GameType
): Promise<{ room: Room } | { error: string }> {
  const room = await getRoom(code);
  if (!room) return { error: "Sala no encontrada" };
  if (room.hostId !== hostId) return { error: "Solo el host puede elegir el juego" };
  if (room.status !== "lobby") return { error: "La partida ya comenzó" };

  room.gameType = gameType;
  await saveRoom(room);
  return { room };
}

export async function startGame(
  code: string,
  hostId: string
): Promise<{ room: Room } | { error: string }> {
  const room = await getRoom(code);
  if (!room) return { error: "Sala no encontrada" };
  if (room.hostId !== hostId) return { error: "Solo el host puede iniciar" };
  if (!room.gameType) return { error: "Selecciona un juego primero" };
  if (room.status !== "lobby") return { error: "La partida ya comenzó" };

  const connected = room.players.filter((p) => p.isConnected);
  const engine = getEngine(room.gameType);

  if (connected.length < engine.minPlayers) {
    return { error: `Mínimo ${engine.minPlayers} jugador(es) requerido(s)` };
  }

  room.status = "playing";
  room.gameState = engine.createInitialState(connected);
  await saveRoom(room);
  return { room };
}

export async function applyGameAction(
  code: string,
  playerId: string,
  action: GameActionPayload
): Promise<{ room: Room } | { error: string }> {
  const room = await getRoom(code);
  if (!room) return { error: "Sala no encontrada" };
  if (!room.gameType || !room.gameState) return { error: "No hay partida activa" };

  const engine = getEngine(room.gameType);
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return { error: "Jugador no encontrado" };

  const valid = engine.getValidActions(room.gameState, playerId);
  if (!valid.some((v) => v.type === action.type)) {
    return { error: "Acción no válida en este momento" };
  }

  if (action.type === "bet" && room.gameType === "blackjack") {
    const amount = action.amount as number;
    if (player.chips < amount) return { error: "Fichas insuficientes" };
    player.chips -= amount;
  }

  if (action.type === "double" && room.gameType === "blackjack") {
    const bjState = room.gameState as BlackjackState;
    const ps = bjState.players.find((p) => p.playerId === playerId);
    const handIdx = ps?.currentHandIndex ?? 0;
    const bet = ps?.hands[handIdx]?.bet ?? 0;
    if (player.chips < bet) return { error: "Fichas insuficientes para doblar" };
    player.chips -= bet;
  }

  if (action.type === "split" && room.gameType === "blackjack") {
    const bjState = room.gameState as BlackjackState;
    const ps = bjState.players.find((p) => p.playerId === playerId);
    const bet = ps?.hands[0]?.bet ?? 0;
    if (player.chips < bet) return { error: "Fichas insuficientes para dividir" };
    player.chips -= bet;
  }

  if (action.type === "newRound" && room.gameType === "blackjack") {
    const connected = room.players.filter((p) => p.isConnected);
    room.gameState = engine.createInitialState(connected);
    await saveRoom(room);
    return { room };
  }

  if (action.type === "startHand" && room.gameType === "poker") {
    const connected = room.players.filter((p) => p.isConnected);
    room.gameState = engine.createInitialState(connected);
    room.gameState = engine.applyAction(room.gameState, playerId, action);
    deductPokerBlinds(room);
    await saveRoom(room);
    return { room };
  }

  if (room.gameType === "poker") {
    const chipError = deductPokerAction(room, playerId, action);
    if (chipError) return { error: chipError };
  }

  room.gameState = engine.applyAction(room.gameState, playerId, action);

  if (room.gameType === "blackjack") syncBlackjackPayouts(room);

  if (room.gameType === "poker") {
    const pState = room.gameState as PokerState;
    if (
      (pState.phase === "showdown" || pState.phase === "roundEnd") &&
      pState.winners.length > 0 &&
      !pState.winnersPaid
    ) {
      for (const w of pState.winners) {
        const wPlayer = room.players.find((p) => p.id === w.playerId);
        if (wPlayer) wPlayer.chips += w.amount;
      }
      pState.winnersPaid = true;
    }
  }

  await saveRoom(room);
  return { room };
}

function deductPokerBlinds(room: Room): void {
  const state = room.gameState as PokerState;
  for (const ps of state.players) {
    if (ps.bet > 0) {
      const player = room.players.find((p) => p.id === ps.playerId);
      if (player) player.chips = Math.max(0, player.chips - ps.bet);
    }
  }
}

function deductPokerAction(
  room: Room,
  playerId: string,
  action: GameActionPayload
): string | null {
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return "Jugador no encontrado";
  const state = room.gameState as PokerState;
  const ps = state.players.find((p) => p.playerId === playerId);
  if (!ps) return null;

  if (action.type === "call") {
    const toCall = state.currentBet - ps.bet;
    if (player.chips < toCall) return "Fichas insuficientes";
    player.chips -= toCall;
  } else if (action.type === "raise") {
    const amount = (action.amount as number) ?? state.currentBet + state.bigBlind;
    const raiseBy = amount - ps.bet;
    if (player.chips < raiseBy) return "Fichas insuficientes";
    player.chips -= raiseBy;
  } else if (action.type === "all-in") {
    if (player.chips <= 0) return "Sin fichas";
    player.chips = 0;
  }
  return null;
}

export function getPublicRoom(room: Room, viewerId?: string): Room {
  if (!room.gameState || !room.gameType) return room;
  const engine = getEngine(room.gameType);
  return {
    ...room,
    gameState: engine.getPublicState(room.gameState, viewerId),
  };
}
