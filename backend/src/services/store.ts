import {
  createSupabaseAdmin,
  type DatabasePlayer,
  type DatabaseRoom,
} from "./supabase";
import type { GameType, Player, Room, RoomStatus } from "../types";
import type { SupabaseClient } from "@supabase/supabase-js";

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
  };
}

function assembleRoom(row: DatabaseRoom, players: DatabasePlayer[]): Room {
  return {
    code: row.code,
    hostId: row.host_id,
    gameType: row.game_type as GameType | null,
    status: row.status as RoomStatus,
    players: players.map(dbPlayerToPlayer),
    gameState: row.game_state as Room["gameState"],
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
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

    return assembleRoom(row as DatabaseRoom, (players ?? []) as DatabasePlayer[]);
  }

  return globalMemory().get(normalized) ?? null;
}

export async function saveRoom(room: Room): Promise<void> {
  room.code = room.code.toUpperCase();
  room.updatedAt = Date.now();
  const supabase = createSupabaseAdmin();

  if (supabase) {
    const { data: existing } = await supabase
      .from("rooms")
      .select("id")
      .eq("code", room.code)
      .single();

    let roomId = existing?.id as string | undefined;

    if (!roomId) {
      const { data: inserted, error } = await supabase
        .from("rooms")
        .insert({
          code: room.code,
          host_id: room.hostId,
          game_type: room.gameType,
          status: room.status,
          game_state: room.gameState,
        })
        .select("id")
        .single();
      if (error || !inserted?.id) throw error ?? new Error("No se pudo crear la sala");
      roomId = inserted.id;
    } else {
      const { error } = await supabase
        .from("rooms")
        .update({
          host_id: room.hostId,
          game_type: room.gameType,
          status: room.status,
          game_state: room.gameState,
          updated_at: new Date().toISOString(),
        })
        .eq("id", roomId);
      if (error) throw error;
    }

    if (!roomId) throw new Error("ID de sala no disponible");

    memoryRoomIds.set(room.code, roomId);
    await syncRoomPlayers(supabase, roomId, room.players);
    return;
  }

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
