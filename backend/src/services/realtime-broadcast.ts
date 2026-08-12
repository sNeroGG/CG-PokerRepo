import { createSupabaseAdmin, isSupabaseConfigured } from "./supabase";

export const ROOM_BROADCAST_EVENT = "room_state";

export function roomChannelName(code: string): string {
  return `room:${code.toUpperCase()}`;
}

/**
 * Publica un payload por Supabase Realtime Broadcast (HTTP + fallback WS).
 * En modo memoria / sin Supabase no hace nada.
 */
export async function broadcastRoomPayload(
  code: string,
  payload: { room: unknown }
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  const topic = roomChannelName(code);

  try {
    const res = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            topic,
            event: ROOM_BROADCAST_EVENT,
            payload,
          },
        ],
      }),
    });

    if (res.ok) return;

    const supabase = createSupabaseAdmin();
    if (!supabase) return;

    const channel = supabase.channel(topic);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        void supabase.removeChannel(channel);
        reject(new Error("broadcast subscribe timeout"));
      }, 2500);

      channel.subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        clearTimeout(timer);
        void channel
          .send({
            type: "broadcast",
            event: ROOM_BROADCAST_EVENT,
            payload,
          })
          .then(() => supabase.removeChannel(channel))
          .then(() => resolve())
          .catch(reject);
      });
    });
  } catch (err) {
    console.error("[realtime-broadcast]", code, err);
  }
}
