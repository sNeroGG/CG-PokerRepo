import { createClient, SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function createSupabaseAdmin(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;

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
};
