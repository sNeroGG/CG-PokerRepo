"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Room } from "@cg/backend/types";
import { api } from "@/lib/client";
import { createSupabaseBrowser, isSupabaseEnabled } from "@/lib/supabase/client";

const POLL_MS = 2000;

export function useRoom(code: string, playerId: string) {
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const mounted = useRef(true);

  const fetchRoom = useCallback(async () => {
    try {
      const { room: data } = await api<{ room: Room }>(
        `/api/rooms/${code}?playerId=${playerId}`
      );
      if (mounted.current) {
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

  useEffect(() => {
    mounted.current = true;
    fetchRoom();

    const supabase = createSupabaseBrowser();
    let channel: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null;

    if (supabase && isSupabaseEnabled()) {
      channel = supabase
        .channel(`room:${code}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "rooms",
            filter: `code=eq.${code.toUpperCase()}`,
          },
          () => fetchRoom()
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "room_players" },
          () => fetchRoom()
        )
        .subscribe();
    }

    const poll = setInterval(fetchRoom, POLL_MS);

    return () => {
      mounted.current = false;
      clearInterval(poll);
      if (channel && supabase) supabase.removeChannel(channel);
    };
  }, [code, fetchRoom]);

  return { room, loading, error, setRoom, refresh: fetchRoom };
}
