"use client";

import type { Player } from "@cg/backend/types";

export function PlayerList({
  players,
  currentPlayerId,
  variant = "default",
}: {
  players: Player[];
  currentPlayerId?: string;
  variant?: "default" | "auth";
}) {
  const rowClass =
    variant === "auth"
      ? "auth-player-row flex items-center justify-between"
      : "flex items-center justify-between rounded-xl px-3 py-2.5 text-sm bg-black/30";
  const activeClass = variant === "auth" ? "auth-player-row-active" : "border border-casino-gold/30 bg-casino-gold/10";
  const avatarClass = variant === "auth" ? "auth-avatar" : "player-avatar text-xs";

  return (
    <div className="space-y-2">
      {players.map((player) => (
        <div
          key={player.id}
          className={`${rowClass} ${player.id === currentPlayerId ? activeClass : variant === "auth" ? "" : ""} ${!player.isConnected ? "opacity-40" : ""}`}
        >
          <div className="flex items-center gap-2.5">
            <div className={avatarClass}>
              {player.name[0]?.toUpperCase() ?? "?"}
            </div>
            <div>
              <span className="font-medium text-white">
                {player.name}
                {player.isHost && (
                  <span className="auth-badge ml-1.5">Host</span>
                )}
              </span>
              <div className="flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${player.isConnected ? "bg-casino-gold" : "bg-white/20"}`}
                />
                <span className="text-[10px] text-white/40">
                  {player.isConnected ? "En línea" : "Desconectado"}
                </span>
              </div>
            </div>
          </div>
          <span className="font-semibold text-casino-gold">${player.chips}</span>
        </div>
      ))}
    </div>
  );
}
