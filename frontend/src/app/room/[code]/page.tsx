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
import { BlackjackTable } from "@/components/games/blackjack/BlackjackTable";
import { PokerTable } from "@/components/games/poker/PokerTable";
import type { GameType, Room } from "@cg/backend/types";

const GAMES = [
  { id: "blackjack" as GameType, name: "Blackjack", icon: "🃏", desc: "21 contra el crupier", min: 1, max: 6 },
  { id: "poker" as GameType, name: "Texas Hold'em", icon: "♠️", desc: "Póker multijugador", min: 2, max: 6 },
];

function countVotes(players: Room["players"], gameId: GameType) {
  return players.filter((p) => p.isConnected && p.gameVote === gameId).length;
}

function votersFor(players: Room["players"], gameId: GameType) {
  return players.filter((p) => p.isConnected && p.gameVote === gameId);
}

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
  const myVote = me?.gameVote ?? null;
  const selectedGame = room?.gameType ?? null;

  async function voteGame(gameType: GameType, e?: React.MouseEvent) {
    e?.stopPropagation();
    setActionLoading(true);
    setActionError("");
    try {
      const { room: updated } = await api<{ room: Room }>(`/api/rooms/${code}/vote`, {
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
          <BlackjackTable room={room} playerId={playerId} onUpdate={setRoom} isHost={isHost} />
        ) : (
          <PokerTable room={room} playerId={playerId} onUpdate={setRoom} isHost={isHost} />
        )}
      </main>
    );
  }

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
              ? "Tú eliges el juego. Los demás solo votan 😊"
              : "Vota 😊 tu preferencia. El host elige el juego."}
          </p>
        </aside>

        <section className="auth-panel min-h-[420px] space-y-6">
          <div className="text-center">
            <h2 className="font-display text-xl text-white">
              {isHost ? "Elige el juego" : "Lobby de espera"}
            </h2>
            <p className="auth-subtitle !mt-1 !normal-case !tracking-normal">
              {isHost
                ? "Selecciona un juego para jugar. Los votos 😊 son solo referencia."
                : "Pulsa 😊 para votar. El host decide cuál se juega."}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {GAMES.map((g) => {
              const votes = countVotes(room.players, g.id);
              const isMyVote = myVote === g.id;
              const isSelected = selectedGame === g.id;
              const voterNames = votersFor(room.players, g.id)
                .map((p) => (p.id === playerId ? "Tú" : p.name))
                .slice(0, 4);

              return (
                <div
                  key={g.id}
                  role={isHost ? "button" : undefined}
                  tabIndex={isHost ? 0 : undefined}
                  onClick={isHost ? () => selectGame(g.id) : undefined}
                  onKeyDown={
                    isHost
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") selectGame(g.id);
                        }
                      : undefined
                  }
                  className={`auth-game-card text-left transition-all
                    ${isSelected ? "auth-game-card-selected ring-2 ring-casino-gold" : ""}
                    ${isHost ? "cursor-pointer hover:border-casino-gold/40" : "cursor-default"}`}
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

                  {/* Votos — todos */}
                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/10 pt-3">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-white/40">
                        Votos
                      </p>
                      <p className="text-sm text-white/70">
                        {votes > 0 ? (
                          <>
                            {votes} 😊
                            <span className="ml-1 text-xs text-white/40">
                              ({voterNames.join(", ")})
                            </span>
                          </>
                        ) : (
                          <span className="text-white/30">Nadie aún</span>
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={(e) => voteGame(g.id, e)}
                      className={`lobby-vote-btn shrink-0 ${isMyVote ? "lobby-vote-btn--active" : ""}`}
                      title="Votar por este juego"
                    >
                      <span className="text-xl leading-none">😊</span>
                      <span className="text-[10px] font-semibold">
                        {isMyVote ? "Votaste" : "Votar"}
                      </span>
                    </button>
                  </div>

                  {isHost && (
                    <p className="mt-2 text-center text-[10px] text-white/35">
                      {isSelected ? "✓ Seleccionado para jugar" : "Clic en la tarjeta para elegir"}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {isHost && (
            <div className="text-center space-y-2">
              <button
                className="auth-btn-primary max-w-xs mx-auto"
                disabled={actionLoading || !selectedGame}
                onClick={startGame}
              >
                {actionLoading ? "Iniciando..." : "▶ Iniciar Partida"}
              </button>
              {!selectedGame && (
                <p className="text-xs text-white/40">Selecciona un juego en las tarjetas de arriba</p>
              )}
              {selectedGame && (
                <p className="text-xs text-casino-gold/80">
                  Juego elegido: {GAMES.find((g) => g.id === selectedGame)?.name}
                </p>
              )}
            </div>
          )}

          {!isHost && (
            <p className="text-center text-xs text-white/40">
              {myVote
                ? `Votaste por ${GAMES.find((g) => g.id === myVote)?.name}. Esperando al host...`
                : "Pulsa 😊 en el juego que prefieres"}
            </p>
          )}

          {actionError && <p className="auth-error">{actionError}</p>}
        </section>
      </div>
    </main>
  );
}
