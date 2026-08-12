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
  if (
    hydrated.status === "lobby" ||
    !hydrated.gameType ||
    !hydrated.gameState ||
    isLobbyState(hydrated.gameState)
  ) {
    return hydrated;
  }
  const engine = getEngine(hydrated.gameType);
  return {
    ...hydrated,
    gameState: engine.getPublicState(hydrated.gameState, viewerId),
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
