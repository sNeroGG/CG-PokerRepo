import { createClient, SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function createSupabaseAdmin(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Supabase es obligatorio en producción. Configura NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY."
      );
    }
    return null;
  }

  if (!adminClient) {
    adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
  }
  return adminClient;
}

export type DatabaseRoom = {
  id: string;
  code: string;
  host_id: string;
  game_type: string | null;
  status: string;
  game_state: unknown;
  created_at: string;
  updated_at: string;
  version?: number;
};

export type DatabasePlayer = {
  id: string;
  room_id: string;
  player_id: string;
  name: string;
  chips: number;
  is_host: boolean;
  is_connected: boolean;
  joined_at: string;
  seat_status?: "active" | "waiting";
  game_vote?: "blackjack" | "poker" | null;
  session_token_hash?: string | null;
  last_seen_at?: string | null;
};
