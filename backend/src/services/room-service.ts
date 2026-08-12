import { getEngine } from "../games/registry";
import { generateRoomCode, getRoom, saveRoom } from "./store";
import {
  getPublicRoom,
  hydrateLobbyVotes,
  MAX_ROOM_PLAYERS,
  roomStateForBroadcast,
} from "./public-room";
import { broadcastRoomPayload } from "./realtime-broadcast";
import { recordServerStats } from "./server-stats";
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

  for (const w of state.winners) {
    const wPlayer = room.players.find((p) => p.id === w.playerId);
    if (wPlayer) wPlayer.chips += w.amount;
  }
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
    seatStatus: "active",
    isReady: false,
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

  await commitRoom(room);
  return room;
}

export async function joinRoom(
  code: string,
  playerName: string,
  playerId: string
): Promise<{ room: Room } | { error: string }> {
  const room = await getRoom(code);
  if (!room) return { error: "Sala no encontrada" };

  const existing = room.players.find((p) => p.id === playerId);
  if (existing) {
    existing.isConnected = true;
    existing.name = playerName;
    await commitRoom(room);
    return { room };
  }

  if (room.players.length >= MAX_ROOM_PLAYERS) {
    return { error: `Sala llena (máx. ${MAX_ROOM_PLAYERS} jugadores)` };
  }

  const joiningMidGame = room.status === "playing";

  room.players.push({
    id: playerId,
    name: playerName,
    chips: STARTING_CHIPS,
    isHost: playerId === room.hostId,
    isConnected: true,
    joinedAt: Date.now(),
    seatStatus: joiningMidGame ? "waiting" : "active",
    isReady: false,
  });

  if (room.status === "lobby") {
    setLobbyReady(room, playerId, false);
  }

  await commitRoom(room);
  return { room: room.status === "lobby" ? hydrateLobbyVotes(room) : room };
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
  await commitRoom(room);
  return { room: hydrateLobbyVotes(room) };
}

export async function voteGame(
  code: string,
  playerId: string,
  gameType: GameType
): Promise<{ room: Room } | { error: string }> {
  const room = await getRoom(code);
  if (!room) return { error: "Sala no encontrada" };
  if (room.status !== "lobby") return { error: "La partida ya comenzó" };

  const player = room.players.find((p) => p.id === playerId);
  if (!player) return { error: "Jugador no encontrado" };

  setLobbyVote(room, playerId, gameType);
  await commitRoom(room);
  return { room: hydrateLobbyVotes(room) };
}

export async function setPlayerReady(
  code: string,
  playerId: string,
  ready: boolean
): Promise<{ room: Room } | { error: string }> {
  const room = await getRoom(code);
  if (!room) return { error: "Sala no encontrada" };
  if (room.status !== "lobby") return { error: "La partida ya comenzó" };

  const player = room.players.find((p) => p.id === playerId);
  if (!player) return { error: "Jugador no encontrado" };
  if (!player.isConnected) return { error: "Jugador desconectado" };

  setLobbyReady(room, playerId, ready);
  await commitRoom(room);
  return { room: hydrateLobbyVotes(room) };
}

export async function startGame(
  code: string,
  hostId: string
): Promise<{ room: Room } | { error: string }> {
  const room = await getRoom(code);
  if (!room) return { error: "Sala no encontrada" };
  if (room.hostId !== hostId) return { error: "Solo el host puede iniciar" };
  if (room.status !== "lobby") return { error: "La partida ya comenzó" };
  if (!room.gameType) return { error: "El host debe seleccionar un juego primero" };

  if (!allConnectedReady(room)) {
    const pending = connectedLobbyPlayers(room)
      .filter((p) => !(getLobbyReady(room)[p.id] || p.isReady))
      .map((p) => p.name);
    return {
      error:
        pending.length > 0
          ? `Todos deben estar listos. Faltan: ${pending.join(", ")}`
          : "Todos los jugadores deben estar listos",
    };
  }

  const seated = getSeatedPlayers(room);
  const engine = getEngine(room.gameType);

  if (seated.length < engine.minPlayers) {
    return { error: `Mínimo ${engine.minPlayers} jugador(es) requerido(s)` };
  }
  if (seated.length > engine.maxPlayers) {
    return { error: `Máximo ${engine.maxPlayers} jugadores en mesa` };
  }

  room.status = "playing";
  room.gameState = engine.createInitialState(seated);
  await commitRoom(room);
  return { room };
}

export async function applyGameAction(
  code: string,
  playerId: string,
  action: GameActionPayload
): Promise<{ room: Room } | { error: string }> {
  const room = await getRoom(code);
  if (!room) return { error: "Sala no encontrada" };
  if (!room.gameType || !room.gameState || isLobbyState(room.gameState)) {
    return { error: "No hay partida activa" };
  }

  const engine = getEngine(room.gameType);
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return { error: "Jugador no encontrado" };
  if (player.seatStatus === "waiting") {
    return { error: "Estás en sala de espera hasta la próxima ronda" };
  }

  if (
    (action.type === "newRound" || action.type === "startHand") &&
    room.hostId !== playerId
  ) {
    return { error: "Solo el host puede iniciar la siguiente ronda" };
  }

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
    promoteWaitingPlayers(room);
    const seated = getSeatedPlayers(room);
    if (seated.length > engine.maxPlayers) {
      return { error: `Máximo ${engine.maxPlayers} jugadores en mesa` };
    }
    room.gameState = engine.createInitialState(seated);
    await commitRoom(room);
    return { room };
  }

  if (action.type === "startHand" && room.gameType === "poker") {
    promoteWaitingPlayers(room);
    const seated = getSeatedPlayers(room);
    if (seated.length > engine.maxPlayers) {
      return { error: `Máximo ${engine.maxPlayers} jugadores en mesa` };
    }
    room.gameState = engine.createInitialState(seated);
    room.gameState = engine.applyAction(room.gameState, playerId, action);
    deductPokerBlinds(room);
    await commitRoom(room);
    return { room };
  }

  if (room.gameType === "poker") {
    const chipError = deductPokerAction(room, playerId, action);
    if (chipError) return { error: chipError };
  }

  room.gameState = engine.applyAction(room.gameState, playerId, action);

  if (room.gameType === "blackjack") await syncBlackjackPayouts(room);

  if (room.gameType === "poker") await syncPokerPayouts(room);

  await commitRoom(room);
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

