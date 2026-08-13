import { getEngine } from "../games/registry";
import type { Room } from "../types";
import { isLobbyState } from "../types";

/** Capacidad de sala (blackjack y poker). */
export const MAX_ROOM_PLAYERS = 8;

export function hydrateLobbyVotes(room: Room): Room {
  if (room.status !== "lobby" || !isLobbyState(room.gameState)) return room;
  const votes = room.gameState.lobbyVotes;
  const ready = room.gameState.readyByPlayer ?? {};
  for (const player of room.players) {
    if (votes[player.id]) player.gameVote = votes[player.id];
    player.isReady = ready[player.id] === true;
  }
  return room;
}

export function getPublicRoom(room: Room, viewerId?: string): Room {
  const hydrated = hydrateLobbyVotes(room);
  const safeRoom: Room = {
    ...hydrated,
    players: hydrated.players.map(({ sessionTokenHash: _secret, ...player }) => player),
  };
  if (
    safeRoom.status === "lobby" ||
    !safeRoom.gameType ||
    !safeRoom.gameState ||
    isLobbyState(safeRoom.gameState)
  ) {
    return safeRoom;
  }
  const engine = getEngine(safeRoom.gameType);
  return {
    ...safeRoom,
    gameState: engine.getPublicState(safeRoom.gameState, viewerId),
  };
}

/** Snapshot compartido para Broadcast (sin mazo ni cartas privadas). */
export function roomStateForBroadcast(room: Room): Room {
  const publicRoom = getPublicRoom(room);
  if (
    !publicRoom.gameState ||
    isLobbyState(publicRoom.gameState) ||
    publicRoom.status === "lobby"
  ) {
    return publicRoom;
  }
  return {
    ...publicRoom,
    gameState: {
      ...publicRoom.gameState,
      deck: [],
    },
  };
}
