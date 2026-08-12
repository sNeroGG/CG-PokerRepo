"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { getPlayerId, api } from "@/lib/client";
import { useRoom } from "@/hooks/useRoom";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { BrandName } from "@/components/brand/BrandName";
import "@/components/brand/brand-slots.css";
import { PlayerList } from "@/components/lobby/PlayerList";
import { WaitingRoomView } from "@/components/lobby/WaitingRoomView";
import { CardStylePicker } from "@/components/lobby/CardStylePicker";
import { BlackjackTable } from "@/components/games/blackjack/BlackjackTable";
import { PokerTable } from "@/components/games/poker/PokerTable";
import type { GameType, Room } from "@cg/backend/types";

const GAMES = [
  { id: "blackjack" as GameType, name: "Blackjack", icon: "🃏", desc: "21 contra el crupier", min: 1, max: 8 },
  { id: "poker" as GameType, name: "Texas Hold'em", icon: "♠️", desc: "Póker multijugador", min: 2, max: 8 },
];

export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const playerId = getPlayerId();
  const { room, loading, error, setRoom } = useRoom(code, playerId);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [copied, setCopied] = useState(false);

  const isHost = room?.hostId === playerId;
  const me = room?.players.find((p) => p.id === playerId);
  const isWaiting = me?.seatStatus === "waiting";
  const selectedGame = room?.gameType ?? null;
  const connectedPlayers = room?.players.filter((p) => p.isConnected) ?? [];
  const readyCount = connectedPlayers.filter((p) => p.isReady).length;
  const allReady =
    connectedPlayers.length > 0 && connectedPlayers.every((p) => p.isReady);
  const iAmReady = me?.isReady === true;

  async function selectGame(gameType: GameType) {
    if (!isHost) return;
    setActionLoading(true);
    setActionError("");
    try {
      const { room: updated } = await api<{ room: Room }>(`/api/rooms/${code}/game-type`, {
        method: "POST",
        body: JSON.stringify({ playerId, gameType }),
      });
      setRoom(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Error");
    } finally {
      setActionLoading(false);
    }
  }

  async function toggleReady() {
    setActionLoading(true);
    setActionError("");
    try {
      const { room: updated } = await api<{ room: Room }>(`/api/rooms/${code}/ready`, {
        method: "POST",
        body: JSON.stringify({ playerId, ready: !iAmReady }),
      });
      setRoom(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Error");
    } finally {
      setActionLoading(false);
    }
  }

  async function startGame() {
    setActionLoading(true);
    setActionError("");
    try {
      const { room: updated } = await api<{ room: Room }>(`/api/rooms/${code}/start`, {
        method: "POST",
        body: JSON.stringify({ playerId }),
      });
      setRoom(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Error");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="auth-page flex min-h-screen flex-col items-center justify-center gap-4">
        <div className="auth-logo-ring animate-pulse">
          <BrandLogo size="lg" />
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

  if (playing && isWaiting) {
    return (
      <WaitingRoomView
        room={room}
        playerId={playerId}
        onHome={() => router.push("/")}
      />
    );
  }

  if (playing) {
    return (
      <main className="game-shell min-h-0 overflow-hidden">
        {isBlackjack ? (
          <BlackjackTable room={room} playerId={playerId} onUpdate={setRoom} isHost={isHost} />
        ) : (
          <PokerTable room={room} playerId={playerId} onUpdate={setRoom} isHost={isHost} />
        )}
      </main>
    );
  }

  const pendingNames = connectedPlayers.filter((p) => !p.isReady).map((p) => p.name);

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
        <div className="flex items-center gap-2">
          <CardStylePicker />
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
        </div>
      </header>

      <div className="relative z-10 grid gap-5 lg:grid-cols-[280px_1fr]">
        <aside className="auth-sidebar">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white/50">
              Jugadores
            </h2>
            <span className="auth-badge">
              {readyCount}/{connectedPlayers.length} listos
            </span>
          </div>
          <PlayerList
            players={room.players}
            currentPlayerId={playerId}
            variant="auth"
            showReady
          />
          <p className="border-t border-white/5 pt-3 text-xs text-white/40">
            Todos deben pulsar Listo antes de iniciar.
          </p>
        </aside>

        <section className="auth-panel min-h-[420px] space-y-6">
          <div className="text-center">
            <h2 className="font-display text-xl text-white">
              {isHost ? "Prepara la partida" : "Lobby de espera"}
            </h2>
            <p className="auth-subtitle !mt-1 !normal-case !tracking-normal">
              {isHost
                ? "Elige el juego y marca Listo. Solo puedes iniciar cuando todos estén listos."
                : "Marca Listo cuando quieras jugar. El host inicia cuando todos estén listos."}
            </p>
          </div>

          {isHost && (
            <div className="grid gap-3 sm:grid-cols-2">
              {GAMES.map((g) => {
                const isSelected = selectedGame === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    disabled={actionLoading}
                    onClick={() => selectGame(g.id)}
                    className={`auth-game-card text-left transition-all
                      ${isSelected ? "auth-game-card-selected ring-2 ring-casino-gold" : ""}
                      cursor-pointer hover:border-casino-gold/40`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-4xl">{g.icon}</span>
                      {isSelected && (
                        <span className="auth-badge shrink-0">Elegido</span>
                      )}
                    </div>
                    <h3 className="mt-3 font-display text-lg font-bold text-white">{g.name}</h3>
                    <p className="mt-1 text-sm text-white/50">{g.desc}</p>
                    <p className="mt-2 text-xs text-casino-gold">
                      {g.min}–{g.max} jugadores
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          {!isHost && selectedGame && (
            <p className="text-center text-sm text-casino-gold/90">
              Juego: {GAMES.find((g) => g.id === selectedGame)?.name}
            </p>
          )}

          {!isHost && !selectedGame && (
            <p className="text-center text-xs text-white/40">
              Esperando a que el host elija el juego…
            </p>
          )}

          <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-3">
            <button
              type="button"
              className={`w-full ${iAmReady ? "auth-btn-secondary" : "auth-btn-primary"}`}
              disabled={actionLoading}
              onClick={toggleReady}
            >
              {actionLoading
                ? "…"
                : iAmReady
                  ? "✓ Listo — tocar para cancelar"
                  : "Listo"}
            </button>

            <p className="text-center text-xs text-white/45">
              {allReady
                ? "Todos listos"
                : pendingNames.length > 0
                  ? `Faltan: ${pendingNames.join(", ")}`
                  : "Esperando jugadores…"}
            </p>

            {isHost && (
              <button
                type="button"
                className="auth-btn-secondary w-full"
                disabled={actionLoading || !selectedGame || !allReady}
                onClick={startGame}
              >
                {actionLoading ? "Iniciando..." : "▶ Iniciar Partida"}
              </button>
            )}

            {isHost && !selectedGame && (
              <p className="text-xs text-white/40">Selecciona un juego arriba</p>
            )}
            {isHost && selectedGame && !allReady && (
              <p className="text-xs text-white/40">
                No se puede iniciar hasta que todos estén listos
              </p>
            )}
          </div>

          {actionError && <p className="auth-error">{actionError}</p>}
        </section>
      </div>
    </main>
  );
}
