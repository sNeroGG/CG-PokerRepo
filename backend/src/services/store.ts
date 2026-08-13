import {
  createSupabaseAdmin,
  type DatabasePlayer,
  type DatabaseRoom,
} from "./supabase";
import type { GameType, Player, Room, RoomStatus } from "../types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hydrateLobbyVotes } from "./public-room";

export { hydrateLobbyVotes };

const memoryRooms = new Map<string, Room>();
const memoryRoomIds = new Map<string, string>();

function globalMemory(): Map<string, Room> {
  const g = globalThis as typeof globalThis & { __cgRooms?: Map<string, Room> };
  if (!g.__cgRooms) g.__cgRooms = memoryRooms;
  return g.__cgRooms;
}

export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function dbPlayerToPlayer(row: DatabasePlayer): Player {
  return {
    id: row.player_id,
    name: row.name,
    chips: row.chips,
    isHost: row.is_host,
    isConnected: row.is_connected,
    joinedAt: new Date(row.joined_at).getTime(),
    seatStatus: row.seat_status ?? "active",
    gameVote: (row.game_vote as GameType | null) ?? null,
    sessionTokenHash: row.session_token_hash ?? undefined,
    lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at).getTime() : Date.now(),
  };
}

function assembleRoom(row: DatabaseRoom, players: DatabasePlayer[]): Room {
  const room: Room = {
    code: row.code,
    hostId: row.host_id,
    gameType: row.game_type as GameType | null,
    status: row.status as RoomStatus,
    players: players.map(dbPlayerToPlayer),
    gameState: row.game_state as Room["gameState"],
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    version: row.version ?? 1,
  };
  return hydrateLobbyVotes(room);
}

function isMissingColumnError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("seat_status") ||
    lower.includes("game_vote") ||
    lower.includes("column") ||
    lower.includes("schema cache")
  );
}

async function upsertRoomPlayer(
  supabase: SupabaseClient,
  roomId: string,
  player: Player
): Promise<void> {
  const extended = {
    room_id: roomId,
    player_id: player.id,
    name: player.name,
    chips: player.chips,
    is_host: player.isHost,
    is_connected: player.isConnected,
    seat_status: player.seatStatus ?? "active",
    game_vote: player.gameVote ?? null,
  };

  let { error } = await supabase
    .from("room_players")
    .upsert(extended, { onConflict: "room_id,player_id" });

  if (error && isMissingColumnError(error.message)) {
    const basic = {
      room_id: roomId,
      player_id: player.id,
      name: player.name,
      chips: player.chips,
      is_host: player.isHost,
      is_connected: player.isConnected,
    };
    ({ error } = await supabase
      .from("room_players")
      .upsert(basic, { onConflict: "room_id,player_id" }));
  }

  if (error) throw error;
}

async function syncRoomPlayers(
  supabase: SupabaseClient,
  roomId: string,
  players: Player[]
): Promise<void> {
  for (const player of players) {
    await upsertRoomPlayer(supabase, roomId, player);
  }

  const keepIds = players.map((p) => p.id);
  if (keepIds.length === 0) {
    const { error } = await supabase
      .from("room_players")
      .delete()
      .eq("room_id", roomId);
    if (error) throw error;
    return;
  }

  const { data: existing } = await supabase
    .from("room_players")
    .select("player_id")
    .eq("room_id", roomId);

  const toRemove = (existing ?? [])
    .map((row) => row.player_id as string)
    .filter((id) => !keepIds.includes(id));

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from("room_players")
      .delete()
      .eq("room_id", roomId)
      .in("player_id", toRemove);
    if (error) throw error;
  }
}

export async function getRoom(code: string): Promise<Room | null> {
  void maybeCleanupStaleRooms();

  const normalized = code.toUpperCase();
  const supabase = createSupabaseAdmin();

  if (supabase) {
    const { data: row } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", normalized)
      .single();

    if (!row) return null;

    const { data: players } = await supabase
      .from("room_players")
      .select("*")
      .eq("room_id", row.id)
      .order("joined_at");
    const { data: sessions } = await supabase
      .from("room_player_sessions")
      .select("player_id, token_hash")
      .eq("room_id", row.id);
    const tokenByPlayer = new Map(
      (sessions ?? []).map((session) => [
        session.player_id as string,
        session.token_hash as string,
      ])
    );
    const playersWithSessions = (players ?? []).map((player) => ({
      ...player,
      session_token_hash: tokenByPlayer.get(player.player_id as string) ?? null,
    }));

    return assembleRoom(row as DatabaseRoom, playersWithSessions as DatabasePlayer[]);
  }

  const mem = globalMemory().get(normalized);
  return mem ? hydrateLobbyVotes(structuredClone(mem)) : null;
}

export class RoomVersionConflictError extends Error {
  constructor() {
    super("La sala cambió mientras se procesaba la acción");
    this.name = "RoomVersionConflictError";
  }
}

export async function saveRoom(room: Room): Promise<void> {
  room.code = room.code.toUpperCase();
  room.updatedAt = Date.now();
  const supabase = createSupabaseAdmin();

  if (supabase) {
    const expectedVersion = room.version > 0 ? room.version : null;
    const { data, error } = await supabase.rpc("save_room_atomic", {
      p_code: room.code,
      p_expected_version: expectedVersion,
      p_room: {
        hostId: room.hostId,
        gameType: room.gameType ?? "",
        status: room.status,
        gameState: room.gameState,
      },
      p_players: room.players,
    });

    if (error) {
      if (error.message.includes("ROOM_VERSION_CONFLICT")) {
        throw new RoomVersionConflictError();
      }
      if (error.message.includes("save_room_atomic")) {
        throw new Error(
          "Falta la migración 005_secure_atomic_rooms.sql en Supabase"
        );
      }
      throw error;
    }

    const result = (Array.isArray(data) ? data[0] : data) as
      | { room_id?: string; room_version?: number }
      | null;
    if (!result?.room_id || !result.room_version) {
      throw new Error("Supabase no devolvió la versión de la sala");
    }
    memoryRoomIds.set(room.code, result.room_id);
    room.version = result.room_version;
    return;
  }

  const current = globalMemory().get(room.code);
  if (current && current.version !== room.version) {
    throw new RoomVersionConflictError();
  }
  room.version = (current?.version ?? 0) + 1;
  globalMemory().set(room.code, structuredClone(room));
}

export async function getRoomIdByCode(code: string): Promise<string | null> {
  const supabase = createSupabaseAdmin();
  if (!supabase) return memoryRoomIds.get(code.toUpperCase()) ?? null;

  const { data } = await supabase
    .from("rooms")
    .select("id")
    .eq("code", code.toUpperCase())
    .single();

  return data?.id ?? null;
}

/** Salas sin actividad durante maxIdleMs se eliminan (jugadores incluidos por CASCADE). */
export const ROOM_IDLE_TTL_MS = 10 * 60 * 1000;

const CLEANUP_THROTTLE_MS = 60_000;
let lastCleanupAt = 0;

/** Limpieza oportunista (Hobby no permite crons frecuentes en Vercel). */
async function maybeCleanupStaleRooms(): Promise<void> {
  const now = Date.now();
  if (now - lastCleanupAt < CLEANUP_THROTTLE_MS) return;
  lastCleanupAt = now;
  try {
    await deleteStaleRooms();
  } catch (err) {
    console.error("[room-cleanup]", err);
  }
}

export async function deleteStaleRooms(
  maxIdleMs: number = ROOM_IDLE_TTL_MS
): Promise<{ deleted: number; codes: string[] }> {
  const cutoff = new Date(Date.now() - maxIdleMs).toISOString();
  const supabase = createSupabaseAdmin();

  if (supabase) {
    const { data: stale, error: selectError } = await supabase
      .from("rooms")
      .select("id, code")
      .lt("updated_at", cutoff);

    if (selectError) throw selectError;
    if (!stale?.length) return { deleted: 0, codes: [] };

    const ids = stale.map((row) => row.id as string);
    const { error: deleteError } = await supabase.from("rooms").delete().in("id", ids);
    if (deleteError) throw deleteError;

    for (const row of stale) {
      const code = (row.code as string).toUpperCase();
      memoryRoomIds.delete(code);
      globalMemory().delete(code);
    }

    return { deleted: stale.length, codes: stale.map((row) => row.code as string) };
  }

  const codes: string[] = [];
  const now = Date.now();
  for (const [code, room] of globalMemory()) {
    if (now - room.updatedAt > maxIdleMs) {
      globalMemory().delete(code);
      memoryRoomIds.delete(code);
      codes.push(code);
    }
  }

  return { deleted: codes.length, codes };
}
