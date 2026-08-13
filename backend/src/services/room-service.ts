import { getEngine } from "../games/registry";
import {
  generateRoomCode,
  getRoom,
  RoomVersionConflictError,
  saveRoom,
} from "./store";
import {
  getPublicRoom,
  hydrateLobbyVotes,
  MAX_ROOM_PLAYERS,
  roomStateForBroadcast,
} from "./public-room";
import { broadcastRoomPayload } from "./realtime-broadcast";
import { recordServerStats } from "./server-stats";
import {
  applyPokerTimeout,
  validatePokerAction,
} from "../games/poker/engine";
import type {
  BlackjackState,
  GameActionPayload,
  GameType,
  Player,
  PokerState,
  Room,
} from "../types";
import { isLobbyState } from "../types";

export {
  getPublicRoom,
  hydrateLobbyVotes,
  MAX_ROOM_PLAYERS,
  roomStateForBroadcast,
};

const STARTING_CHIPS = 1000;
export const PRESENCE_TIMEOUT_MS = 45_000;
const MAX_MUTATION_RETRIES = 16;

type MutationResult = { room: Room } | { error: string };

function refreshPresence(room: Room, activePlayerId?: string): void {
  const now = Date.now();
  for (const player of room.players) {
    if (player.id === activePlayerId) {
      player.lastSeenAt = now;
      player.isConnected = true;
    } else if (player.lastSeenAt && now - player.lastSeenAt > PRESENCE_TIMEOUT_MS) {
      player.isConnected = false;
    }
  }

  const host = room.players.find((player) => player.id === room.hostId);
  if (host?.isConnected !== false) return;
  const replacement = room.players
    .filter((player) => player.isConnected)
    .sort((a, b) => a.joinedAt - b.joinedAt)[0];
  if (!replacement) return;
  room.hostId = replacement.id;
  for (const player of room.players) player.isHost = player.id === replacement.id;
}

async function mutateRoom(
  code: string,
  activePlayerId: string | undefined,
  mutation: (room: Room) => string | null | Promise<string | null>
): Promise<MutationResult> {
  for (let attempt = 0; attempt < MAX_MUTATION_RETRIES; attempt += 1) {
    const room = await getRoom(code);
    if (!room) return { error: "Sala no encontrada" };
    refreshPresence(room, activePlayerId);
    const error = await mutation(room);
    if (error) return { error };
    try {
      await commitRoom(room);
      return { room };
    } catch (commitError) {
      if (commitError instanceof RoomVersionConflictError) continue;
      throw commitError;
    }
  }
  return { error: "La sala está procesando otra acción. Intenta de nuevo." };
}

async function commitRoom(room: Room): Promise<void> {
  await saveRoom(room);
  await broadcastRoomPayload(room.code, { room: roomStateForBroadcast(room) });
}

function promoteWaitingPlayers(room: Room): void {
  for (const p of room.players) {
    if (p.seatStatus === "waiting") p.seatStatus = "active";
  }
}

function getSeatedPlayers(room: Room): Player[] {
  return room.players.filter(
    (p) => p.isConnected && (p.seatStatus ?? "active") === "active"
  );
}

function getLobbyVotes(room: Room): Record<string, GameType> {
  if (room.status !== "lobby" || !isLobbyState(room.gameState)) return {};
  return room.gameState.lobbyVotes;
}

function getLobbyReady(room: Room): Record<string, boolean> {
  if (room.status !== "lobby" || !isLobbyState(room.gameState)) return {};
  return room.gameState.readyByPlayer ?? {};
}

function writeLobbyState(
  room: Room,
  patch: { votes?: Record<string, GameType>; ready?: Record<string, boolean> }
): void {
  const votes = patch.votes ?? getLobbyVotes(room);
  const ready = patch.ready ?? getLobbyReady(room);
  room.gameState = { lobbyVotes: votes, readyByPlayer: ready };
}

function setLobbyVote(room: Room, playerId: string, gameType: GameType): void {
  const votes = { ...getLobbyVotes(room), [playerId]: gameType };
  writeLobbyState(room, { votes });
  const player = room.players.find((p) => p.id === playerId);
  if (player) player.gameVote = gameType;
}

function setLobbyReady(room: Room, playerId: string, ready: boolean): void {
  const next = { ...getLobbyReady(room), [playerId]: ready };
  writeLobbyState(room, { ready: next });
  const player = room.players.find((p) => p.id === playerId);
  if (player) player.isReady = ready;
}

function connectedLobbyPlayers(room: Room): Player[] {
  return room.players.filter((p) => p.isConnected);
}

function allConnectedReady(room: Room): boolean {
  const connected = connectedLobbyPlayers(room);
  if (connected.length === 0) return false;
  const readyMap = getLobbyReady(room);
  return connected.every((p) => readyMap[p.id] === true || p.isReady === true);
}

async function syncBlackjackPayouts(room: Room): Promise<void> {
  const state = room.gameState as BlackjackState;
  if (state.phase !== "roundEnd") return;

  const bjMult = state.blackjackPayout === "6:5" ? 2.2 : 2.5;
  const delta = {
    handsPlayed: 0,
    playerWins: 0,
    playerLosses: 0,
    pushes: 0,
    totalWagered: 0,
    totalPaidOut: 0,
  };

  for (const ps of state.players) {
    const player = room.players.find((p) => p.id === ps.playerId);
    if (!player) continue;

    for (const hand of ps.hands) {
      if (hand.payoutDone) continue;

      delta.handsPlayed += 1;
      delta.totalWagered += hand.bet;
      let paidOut = 0;

      switch (hand.status) {
        case "blackjack":
          paidOut = Math.floor(hand.bet * bjMult);
          player.chips += paidOut;
          delta.playerWins += 1;
          break;
        case "won":
          paidOut = hand.bet * 2;
          player.chips += paidOut;
          delta.playerWins += 1;
          break;
        case "push":
          paidOut = hand.bet;
          player.chips += paidOut;
          delta.pushes += 1;
          break;
        case "surrendered":
          paidOut = Math.floor(hand.bet * 0.5);
          player.chips += paidOut;
          delta.playerLosses += 1;
          break;
        default:
          delta.playerLosses += 1;
          break;
      }

      delta.totalPaidOut += paidOut;
      hand.payoutDone = true;
    }
  }

  if (delta.handsPlayed > 0) {
    try {
      await recordServerStats({
        handsPlayed: delta.handsPlayed,
        playerWins: delta.playerWins,
        playerLosses: delta.playerLosses,
        pushes: delta.pushes,
        totalWagered: delta.totalWagered,
        totalPaidOut: delta.totalPaidOut,
      });
    } catch (err) {
      console.error("[server-stats] blackjack", err);
    }
  }
}

async function syncPokerPayouts(room: Room): Promise<void> {
  const state = room.gameState as PokerState;
  if (state.phase !== "showdown" && state.phase !== "roundEnd") return;
  if (state.winners.length === 0 || state.winnersPaid) return;

  const winnerIds = new Set(state.winners.map((w) => w.playerId));
  const paidOut = state.winners.reduce((sum, w) => sum + w.amount, 0);
  const wagered = state.players.reduce((sum, p) => sum + p.totalBet, 0);
  const losses = state.players.filter(
    (p) => p.totalBet > 0 && !p.folded && !winnerIds.has(p.playerId)
  ).length;

  state.winnersPaid = true;

  try {
    await recordServerStats({
      handsPlayed: 1,
      playerWins: winnerIds.size,
      playerLosses: losses,
      totalWagered: wagered,
      totalPaidOut: paidOut,
    });
  } catch (err) {
    console.error("[server-stats] poker", err);
  }
}

function syncPokerStacks(room: Room): void {
  const state = room.gameState as PokerState;
  for (const pokerPlayer of state.players) {
    const player = room.players.find((candidate) => candidate.id === pokerPlayer.playerId);
    if (player) player.chips = pokerPlayer.stack;
  }
}

export async function createRoom(
  hostName: string,
  hostId: string,
  sessionTokenHash?: string
): Promise<Room> {
  let code = generateRoomCode();
  while (await getRoom(code)) code = generateRoomCode();

  const host: Player = {
    id: hostId,
    name: hostName,
    chips: STARTING_CHIPS,
    isHost: true,
    isConnected: true,
    joinedAt: Date.now(),
    seatStatus: "active",
    isReady: false,
    lastSeenAt: Date.now(),
    sessionTokenHash,
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
    version: 0,
  };

  await commitRoom(room);
  return room;
}

export async function joinRoom(
  code: string,
  playerName: string,
  playerId: string,
  sessionTokenHash?: string
): Promise<{ room: Room } | { error: string }> {
  const result = await mutateRoom(code, playerId, (room) => {
    const existing = room.players.find((p) => p.id === playerId);
    if (existing) {
      existing.name = playerName;
      if (sessionTokenHash) existing.sessionTokenHash = sessionTokenHash;
      return null;
    }

    if (room.players.length >= MAX_ROOM_PLAYERS) {
      return `Sala llena (máx. ${MAX_ROOM_PLAYERS} jugadores)`;
    }

    room.players.push({
      id: playerId,
      name: playerName,
      chips: STARTING_CHIPS,
      isHost: playerId === room.hostId,
      isConnected: true,
      joinedAt: Date.now(),
      seatStatus: room.status === "playing" ? "waiting" : "active",
      isReady: false,
      lastSeenAt: Date.now(),
      sessionTokenHash,
    });

    if (room.status === "lobby") setLobbyReady(room, playerId, false);
    return null;
  });
  if ("error" in result) return result;
  return {
    room: result.room.status === "lobby"
      ? hydrateLobbyVotes(result.room)
      : result.room,
  };
}

export async function setGameType(
  code: string,
  hostId: string,
  gameType: GameType
): Promise<{ room: Room } | { error: string }> {
  const result = await mutateRoom(code, hostId, (room) => {
    if (room.hostId !== hostId) return "Solo el host puede elegir el juego";
    if (room.status !== "lobby") return "La partida ya comenzó";
    room.gameType = gameType;
    return null;
  });
  if ("error" in result) return result;
  return { room: hydrateLobbyVotes(result.room) };
}

export async function touchPlayerPresence(
  code: string,
  playerId: string
): Promise<{ room: Room } | { error: string }> {
  return mutateRoom(code, playerId, async (room) => {
    if (!room.players.some((player) => player.id === playerId)) {
      return "Jugador no encontrado";
    }
    if (room.gameType === "poker" && room.gameState && !isLobbyState(room.gameState)) {
      const before = room.gameState as PokerState;
      const after = applyPokerTimeout(before);
      if (after !== before) {
        room.gameState = after;
        syncPokerStacks(room);
        await syncPokerPayouts(room);
      }
    }
    return null;
  });
}

export async function voteGame(
  code: string,
  playerId: string,
  gameType: GameType
): Promise<{ room: Room } | { error: string }> {
  const result = await mutateRoom(code, playerId, (room) => {
    if (room.status !== "lobby") return "La partida ya comenzó";
    if (!room.players.some((p) => p.id === playerId)) return "Jugador no encontrado";
    setLobbyVote(room, playerId, gameType);
    return null;
  });
  if ("error" in result) return result;
  return { room: hydrateLobbyVotes(result.room) };
}

export async function setPlayerReady(
  code: string,
  playerId: string,
  ready: boolean
): Promise<{ room: Room } | { error: string }> {
  const result = await mutateRoom(code, playerId, (room) => {
    if (room.status !== "lobby") return "La partida ya comenzó";
    const player = room.players.find((p) => p.id === playerId);
    if (!player) return "Jugador no encontrado";
    setLobbyReady(room, playerId, ready);
    return null;
  });
  if ("error" in result) return result;
  return { room: hydrateLobbyVotes(result.room) };
}

export async function startGame(
  code: string,
  hostId: string
): Promise<{ room: Room } | { error: string }> {
  return mutateRoom(code, hostId, (room) => {
    if (room.hostId !== hostId) return "Solo el host puede iniciar";
    if (room.status !== "lobby") return "La partida ya comenzó";
    if (!room.gameType) return "El host debe seleccionar un juego primero";

    if (!allConnectedReady(room)) {
      const pending = connectedLobbyPlayers(room)
        .filter((p) => !(getLobbyReady(room)[p.id] || p.isReady))
        .map((p) => p.name);
      return pending.length > 0
        ? `Todos deben estar listos. Faltan: ${pending.join(", ")}`
        : "Todos los jugadores deben estar listos";
    }

    const seated = getSeatedPlayers(room);
    const engine = getEngine(room.gameType);
    if (seated.length < engine.minPlayers) {
      return `Mínimo ${engine.minPlayers} jugador(es) requerido(s)`;
    }
    if (seated.length > engine.maxPlayers) {
      return `Máximo ${engine.maxPlayers} jugadores en mesa`;
    }

    room.status = "playing";
    room.gameState = engine.createInitialState(seated);
    return null;
  });
}

export async function applyGameAction(
  code: string,
  playerId: string,
  action: GameActionPayload
): Promise<{ room: Room } | { error: string }> {
  return mutateRoom(code, playerId, async (room) => {
    if (!room.gameType || !room.gameState || isLobbyState(room.gameState)) {
      return "No hay partida activa";
    }

    const engine = getEngine(room.gameType);
    const player = room.players.find((candidate) => candidate.id === playerId);
    if (!player) return "Jugador no encontrado";
    if (player.seatStatus === "waiting" || player.seatStatus === "sitting-out") {
      return "Estás en sala de espera hasta la próxima ronda";
    }
    if (
      (action.type === "newRound" || action.type === "startHand") &&
      room.hostId !== playerId
    ) {
      return "Solo el host puede iniciar la siguiente ronda";
    }

    if (action.type === "newRound" && room.gameType === "blackjack") {
      promoteWaitingPlayers(room);
      const seated = getSeatedPlayers(room);
      if (seated.length > engine.maxPlayers) {
        return `Máximo ${engine.maxPlayers} jugadores en mesa`;
      }
      room.gameState = engine.createInitialState(seated);
      return null;
    }

    if (action.type === "startHand" && room.gameType === "poker") {
      promoteWaitingPlayers(room);
      const seated = getSeatedPlayers(room).filter((candidate) => candidate.chips > 0);
      if (seated.length < engine.minPlayers) return "Se necesitan dos jugadores con fichas";
      if (seated.length > engine.maxPlayers) {
        return `Máximo ${engine.maxPlayers} jugadores en mesa`;
      }
      const previous = room.gameState as PokerState;
      const previousDealerId = previous.players[previous.dealerIndex]?.playerId;
      const fresh = engine.createInitialState(seated) as PokerState;
      const previousDealerIndex = fresh.players.findIndex(
        (candidate) => candidate.playerId === previousDealerId
      );
      if (previousDealerIndex >= 0) fresh.dealerIndex = previousDealerIndex;
      room.gameState = engine.applyAction(fresh, playerId, action);
      syncPokerStacks(room);
      return null;
    }

    if (room.gameType === "poker") {
      room.gameState = applyPokerTimeout(room.gameState as PokerState);
    }
    const valid = engine.getValidActions(room.gameState, playerId);
    if (!valid.some((candidate) => candidate.type === action.type)) {
      return "Acción no válida en este momento";
    }

    if (room.gameType === "poker") {
      const validationError = validatePokerAction(
        room.gameState as PokerState,
        playerId,
        action
      );
      if (validationError) return validationError;
    }

    if (action.type === "bet" && room.gameType === "blackjack") {
      const amount = Number(action.amount);
      if (!Number.isFinite(amount) || amount <= 0) return "Apuesta no válida";
      if (player.chips < amount) return "Fichas insuficientes";
      player.chips -= amount;
    }

    if (action.type === "double" && room.gameType === "blackjack") {
      const state = room.gameState as BlackjackState;
      const pokerPlayer = state.players.find((candidate) => candidate.playerId === playerId);
      const handIndex = pokerPlayer?.currentHandIndex ?? 0;
      const bet = pokerPlayer?.hands[handIndex]?.bet ?? 0;
      if (player.chips < bet) return "Fichas insuficientes para doblar";
      player.chips -= bet;
    }

    if (action.type === "split" && room.gameType === "blackjack") {
      const state = room.gameState as BlackjackState;
      const blackjackPlayer = state.players.find((candidate) => candidate.playerId === playerId);
      const bet = blackjackPlayer?.hands[0]?.bet ?? 0;
      if (player.chips < bet) return "Fichas insuficientes para dividir";
      player.chips -= bet;
    }

    room.gameState = engine.applyAction(room.gameState, playerId, action);
    if (room.gameType === "blackjack") await syncBlackjackPayouts(room);
    if (room.gameType === "poker") {
      syncPokerStacks(room);
      await syncPokerPayouts(room);
    }
    return null;
  });
}

