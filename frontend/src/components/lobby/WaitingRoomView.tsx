"use client";

import type { Room } from "@cg/backend/types";
import { PlayerList } from "@/components/lobby/PlayerList";
import { BrandName } from "@/components/brand/BrandName";
import { CardStylePicker } from "@/components/lobby/CardStylePicker";

const GAME_LABELS: Record<string, string> = {
  blackjack: "Blackjack",
  poker: "Texas Hold'em",
};

export function WaitingRoomView({
  room,
  playerId,
  onHome,
}: {
  room: Room;
  playerId: string;
  onHome: () => void;
}) {
  const gameLabel = room.gameType ? GAME_LABELS[room.gameType] ?? room.gameType : "Partida";

  return (
    <main className="auth-page mx-auto flex min-h-screen max-w-lg flex-col justify-center p-4">
      <div className="auth-glow" aria-hidden />
      <div className="auth-panel relative z-10 space-y-6 overflow-visible p-6">
        <div className="relative z-20 flex items-start justify-between gap-3 overflow-visible">
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35">
              <BrandName variant="header" />
            </p>
            <h1 className="font-display text-xl font-bold text-white">
              Sala <span className="auth-title-gold">{room.code}</span>
            </h1>
            <p className="mt-2 text-sm text-casino-gold">{gameLabel} en curso</p>
          </div>
          <CardStylePicker />
        </div>

        <div className="rounded-xl border border-casino-gold/25 bg-casino-gold/5 px-4 py-3 text-center">
          <p className="text-sm font-medium text-white">Sala de espera</p>
          <p className="mt-1 text-xs text-white/50">
            Entrarás en la mesa cuando el host inicie la próxima ronda
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">
            Jugadores
          </h2>
          <PlayerList players={room.players} currentPlayerId={playerId} variant="auth" />
        </div>

        <button type="button" className="auth-btn-secondary w-full" onClick={onHome}>
          ← Volver al inicio
        </button>
      </div>
    </main>
  );
}
