"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Room } from "@cg/backend/types";
import { api, getPlayerName } from "@/lib/client";
import { createSupabaseBrowser, isSupabaseEnabled } from "@/lib/supabase/client";
import {
  mergeRoomUpdate,
  shouldApplyRoomUpdate,
} from "@/lib/room/merge-room-update";

/** Fallback si Broadcast/Realtime fallan. */
const POLL_MS = 10_000;
const ROOM_BROADCAST_EVENT = "room_state";

export function useRoom(code: string, playerId: string) {
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const mounted = useRef(true);
  const triedRejoin = useRef(false);
  const roomRef = useRef<Room | null>(null);
  const fetchingPrivate = useRef(false);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  const fetchRoom = useCallback(async () => {
    try {
      let { room: data } = await api<{ room: Room }>(
        `/api/rooms/${code}?playerId=${playerId}`
      );

      if (
        playerId &&
        !data.players.some((p) => p.id === playerId) &&
        !triedRejoin.current
      ) {
        triedRejoin.current = true;
        try {
          const playerName = getPlayerName().trim() || "Jugador";
          const joined = await api<{ room: Room }>(
            `/api/rooms/${code}/join`,
            {
              method: "POST",
              body: JSON.stringify({ playerId, playerName }),
            }
          );
          data = joined.room;
        } catch {
          /* rejoin falló — se reintenta al recargar la página */
        }
      }

      // GET personalizado puede reemplazar el mismo updatedAt del Broadcast compartido
      if (
        mounted.current &&
        (!roomRef.current || data.updatedAt >= roomRef.current.updatedAt)
      ) {
        setRoom(data);
        setError("");
      }
    } catch (e) {
      if (mounted.current) {
        setError(e instanceof Error ? e.message : "Error");
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [code, playerId]);

  const applyBroadcast = useCallback(
    (incoming: Room) => {
      if (!mounted.current) return;
      if (!shouldApplyRoomUpdate(roomRef.current, incoming)) return;

      const { room: merged, needsPrivateRefetch } = mergeRoomUpdate(
        roomRef.current,
        incoming,
        playerId
      );
      setRoom(merged);
      setError("");

      if (needsPrivateRefetch && !fetchingPrivate.current) {
        fetchingPrivate.current = true;
        void fetchRoom().finally(() => {
          fetchingPrivate.current = false;
        });
      }
    },
    [fetchRoom, playerId]
  );

  useEffect(() => {
    mounted.current = true;
    void fetchRoom();

    const supabase = createSupabaseBrowser();
    let channel: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null;

    if (supabase && isSupabaseEnabled()) {
      channel = supabase
        .channel(`room:${code.toUpperCase()}`)
        .on("broadcast", { event: ROOM_BROADCAST_EVENT }, (msg) => {
          const payload = msg.payload as { room?: Room } | undefined;
          if (payload?.room) applyBroadcast(payload.room);
        })
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "rooms",
            filter: `code=eq.${code.toUpperCase()}`,
          },
          () => {
            void fetchRoom();
          }
        )
        .subscribe();
    }

    const poll = setInterval(() => {
      void fetchRoom();
    }, POLL_MS);

    return () => {
      mounted.current = false;
      clearInterval(poll);
      if (channel && supabase) supabase.removeChannel(channel);
    };
  }, [applyBroadcast, code, fetchRoom]);

  return { room, loading, error, setRoom, refresh: fetchRoom };
}
