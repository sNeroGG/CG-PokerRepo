"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { getPlayerId, api } from "@/lib/client";
import { useRoom } from "@/hooks/useRoom";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { BrandName } from "@/components/brand/BrandName";
import "@/components/brand/brand-slots.css";
import { PlayerList } from "@/components/lobby/PlayerList";
import { BlackjackTable } from "@/components/games/blackjack/BlackjackTable";
import { PokerTable } from "@/components/games/poker/PokerTable";
import type { GameType, Room } from "@cg/backend/types";

export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const playerId = getPlayerId();
  const { room, loading, error, setRoom } = useRoom(code, playerId);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [copied, setCopied] = useState(false);

  const isHost = room?.hostId === playerId;
  const games = [
    { id: "blackjack" as GameType, name: "Blackjack", icon: "🃏", desc: "21 contra el crupier CPU", min: 1, max: 6 },
    { id: "poker" as GameType, name: "Texas Hold'em", icon: "♠️", desc: "Póker multijugador clásico", min: 2, max: 6 },
  ];

  async function selectGame(gameType: GameType) {
    setActionLoading(true);
    setActionError("");
    try {
      const { room: updated } = await api<{ room: Room }>(`/api/rooms/${code}/game-type`, {
        method: "POST",
        body: JSON.stringify({ playerId, gameType }),
      });
      setRoom(updated);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Error");
    } finally {
      setActionLoading(false);
    }
  }

  async function startGame() {
    setActionLoading(true);
    try {
      const { room: updated } = await api<{ room: Room }>(`/api/rooms/${code}/start`, {
        method: "POST",
        body: JSON.stringify({ playerId }),
      });
      setRoom(updated);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Error");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="auth-page flex min-h-screen flex-col items-center justify-center gap-4">
        <div className="auth-logo-ring animate-pulse">
          <BrandLogo size="md" />
        </div>
        <p className="text-sm tracking-widest text-white/60 uppercase">Cargando sala...</p>
      </main>
    );
  }

  if (error || !room) {
    return (
      <main className="auth-page flex min-h-screen flex-col items-center justify-center gap-4 p-4">
        <p className="auth-error">{error || "Sala no encontrada"}</p>
        <button className="auth-btn-secondary max-w-xs" onClick={() => router.push("/")}>
          Volver al inicio
        </button>
      </main>
    );
  }

  const playing = room.status === "playing";
  const isBlackjack = playing && room.gameType === "blackjack";

  // Lobby: tema negro / dorado / blanco
  if (!playing) {
    return (
      <main className="auth-page mx-auto min-h-screen max-w-6xl p-4">
        <div className="auth-glow" aria-hidden />

        <header className="relative z-10 mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <button
              onClick={() => router.push("/")}
              className="text-xs text-white/40 transition-colors hover:text-casino-gold"
            >
              ← Menú principal
            </button>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-white/35">
              <BrandName variant="header" />
            </p>
            <h1 className="font-display text-2xl font-bold text-white">
              Sala <span className="auth-title-gold">{code}</span>
            </h1>
          </div>
          <button
            className="auth-btn-secondary !w-auto px-5 py-2 text-sm"
            onClick={() => {
              navigator.clipboard.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? "✓ Copiado" : `Código: ${code}`}
          </button>
        </header>

        <div className="relative z-10 grid gap-5 lg:grid-cols-[280px_1fr]">
          <aside className="auth-sidebar">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-white/50">
                Jugadores
              </h2>
              <span className="auth-badge">
                {room.players.filter((p) => p.isConnected).length} en línea
              </span>
            </div>
            <PlayerList players={room.players} currentPlayerId={playerId} variant="auth" />
            <p className="border-t border-white/5 pt-3 text-xs text-white/40">
              {isHost
                ? "Selecciona un juego e inicia la partida"
                : "Esperando al host para comenzar..."}
            </p>
          </aside>

          <section className="auth-panel min-h-[420px] space-y-6">
            <div className="text-center">
              <h2 className="font-display text-xl text-white">
                {isHost ? "Elige el juego" : "Lobby de espera"}
              </h2>
              <p className="auth-subtitle !mt-1 !normal-case !tracking-normal">
                {isHost ? "Como host, tú decides qué jugar" : "La partida comenzará pronto"}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {games.map((g) => (
                <button
                  key={g.id}
                  disabled={!isHost || actionLoading}
                  onClick={() => selectGame(g.id)}
                  className={`auth-game-card disabled:cursor-default disabled:opacity-60
                    ${room.gameType === g.id ? "auth-game-card-selected" : ""}`}
                >
                  <span className="text-4xl">{g.icon}</span>
                  <h3 className="mt-3 font-display text-lg font-bold text-white">{g.name}</h3>
                  <p className="mt-1 text-sm text-white/50">{g.desc}</p>
                  <p className="mt-3 text-xs text-casino-gold">
                    {g.min}–{g.max} jugadores
                  </p>
                  {room.gameType === g.id && (
                    <span className="auth-badge mt-3 inline-block">Seleccionado</span>
                  )}
                </button>
              ))}
            </div>

            {isHost && room.gameType && (
              <div className="text-center">
                <button
                  className="auth-btn-primary max-w-xs mx-auto"
                  disabled={actionLoading}
                  onClick={startGame}
                >
                  {actionLoading ? "Iniciando..." : "▶ Iniciar Partida"}
                </button>
              </div>
            )}

            {actionError && <p className="auth-error">{actionError}</p>}
          </section>
        </div>
      </main>
    );
  }

  // En juego
  return (
    <main className={isBlackjack ? "min-h-screen" : "auth-page mx-auto min-h-screen max-w-6xl p-4"}>
      {!isBlackjack && (
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <button
              onClick={() => router.push("/")}
              className="text-xs text-white/40 hover:text-casino-gold"
            >
              ← Inicio
            </button>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-white/35">
              <BrandName variant="header" />
            </p>
            <h1 className="font-display text-2xl font-bold text-white">
              Sala <span className="auth-title-gold">{code}</span>
            </h1>
          </div>
          <button
            className="auth-btn-secondary !w-auto px-5 py-2 text-sm"
            onClick={() => {
              navigator.clipboard.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? "✓ Copiado" : `📋 ${code}`}
          </button>
        </header>
      )}

      {isBlackjack ? (
        <BlackjackTable room={room} playerId={playerId} onUpdate={setRoom} />
      ) : (
        <PokerTable room={room} playerId={playerId} onUpdate={setRoom} />
      )}
    </main>
  );
}
