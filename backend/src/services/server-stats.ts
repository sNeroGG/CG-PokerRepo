import { createSupabaseAdmin } from "./supabase";

export interface ServerStatsDelta {
  handsPlayed?: number;
  playerWins?: number;
  playerLosses?: number;
  pushes?: number;
  totalWagered?: number;
  totalPaidOut?: number;
}

type MemoryStats = {
  totalHandsPlayed: number;
  playerWins: number;
  playerLosses: number;
  pushes: number;
  totalWagered: number;
  totalPaidOut: number;
};

function memoryStats(): MemoryStats {
  const g = globalThis as typeof globalThis & { __cgServerStats?: MemoryStats };
  if (!g.__cgServerStats) {
    g.__cgServerStats = {
      totalHandsPlayed: 0,
      playerWins: 0,
      playerLosses: 0,
      pushes: 0,
      totalWagered: 0,
      totalPaidOut: 0,
    };
  }
  return g.__cgServerStats;
}

function applyDelta(base: MemoryStats, delta: ServerStatsDelta): MemoryStats {
  return {
    totalHandsPlayed: base.totalHandsPlayed + (delta.handsPlayed ?? 0),
    playerWins: base.playerWins + (delta.playerWins ?? 0),
    playerLosses: base.playerLosses + (delta.playerLosses ?? 0),
    pushes: base.pushes + (delta.pushes ?? 0),
    totalWagered: base.totalWagered + (delta.totalWagered ?? 0),
    totalPaidOut: base.totalPaidOut + (delta.totalPaidOut ?? 0),
  };
}

export async function recordServerStats(delta: ServerStatsDelta): Promise<void> {
  const hasDelta =
    (delta.handsPlayed ?? 0) > 0 ||
    (delta.playerWins ?? 0) > 0 ||
    (delta.playerLosses ?? 0) > 0 ||
    (delta.pushes ?? 0) > 0 ||
    (delta.totalWagered ?? 0) > 0 ||
    (delta.totalPaidOut ?? 0) > 0;

  if (!hasDelta) return;

  const supabase = createSupabaseAdmin();
  if (!supabase) {
    const next = applyDelta(memoryStats(), delta);
    Object.assign(memoryStats(), next);
    return;
  }

  const { data, error: readError } = await supabase
    .from("server_stats")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (readError && !readError.message.includes("server_stats")) {
    throw readError;
  }

  if (!data) {
    const { error: insertError } = await supabase.from("server_stats").insert({
      id: 1,
      total_hands_played: delta.handsPlayed ?? 0,
      player_wins: delta.playerWins ?? 0,
      player_losses: delta.playerLosses ?? 0,
      pushes: delta.pushes ?? 0,
      total_wagered: delta.totalWagered ?? 0,
      total_paid_out: delta.totalPaidOut ?? 0,
    });
    if (insertError && !insertError.message.includes("server_stats")) throw insertError;
    return;
  }

  const { error: updateError } = await supabase
    .from("server_stats")
    .update({
      total_hands_played:
        Number(data.total_hands_played ?? 0) + (delta.handsPlayed ?? 0),
      player_wins: Number(data.player_wins ?? 0) + (delta.playerWins ?? 0),
      player_losses: Number(data.player_losses ?? 0) + (delta.playerLosses ?? 0),
      pushes: Number(data.pushes ?? 0) + (delta.pushes ?? 0),
      total_wagered: Number(data.total_wagered ?? 0) + (delta.totalWagered ?? 0),
      total_paid_out: Number(data.total_paid_out ?? 0) + (delta.totalPaidOut ?? 0),
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (updateError) throw updateError;
}
