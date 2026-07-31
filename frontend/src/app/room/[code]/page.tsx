"use client";

import { use, useMemo, useState } from "react";
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

  const leadingGame = useMemo(() => {
    if (!room) return null;
    const bj = countVotes(room.players, "blackjack");
    const pk = countVotes(room.players, "poker");
    if (bj > pk) return "blackjack";
    if (pk > bj) return "poker";
    return null;
  }, [room]);

  async function voteGame(gameType: GameType) {
    setActionLoading(true);
    setActionError("");
    try {
      const { room: updated } = await api<{ room: Room }>(`/api/rooms/${code}/vote`, {
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
    setActionError("");
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
  const totalVotes = room.players.filter((p) => p.isConnected && p.gameVote).length;

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
              ? "Inicia cuando haya votos suficientes"
              : "Vota por el juego que quieres jugar"}
          </p>
        </aside>

        <section className="auth-panel min-h-[420px] space-y-6">
          <div className="text-center">
            <h2 className="font-display text-xl text-white">Vota por el juego</h2>
            <p className="auth-subtitle !mt-1 !normal-case !tracking-normal">
              {totalVotes > 0
                ? `${totalVotes} voto${totalVotes !== 1 ? "s" : ""} registrado${totalVotes !== 1 ? "s" : ""}`
                : "Todos pueden votar antes de empezar"}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {GAMES.map((g) => {
              const votes = countVotes(room.players, g.id);
              const isMyVote = myVote === g.id;
              const isLeading = leadingGame === g.id && votes > 0;

              return (
                <button
                  key={g.id}
                  disabled={actionLoading}
                  onClick={() => voteGame(g.id)}
                  className={`auth-game-card disabled:opacity-60
                    ${isMyVote ? "auth-game-card-selected" : ""}
                    ${isLeading ? "ring-1 ring-casino-gold/40" : ""}`}
                >
                  <span className="text-4xl">{g.icon}</span>
                  <h3 className="mt-3 font-display text-lg font-bold text-white">{g.name}</h3>
                  <p className="mt-1 text-sm text-white/50">{g.desc}</p>
                  <p className="mt-3 text-xs text-casino-gold">
                    {g.min}–{g.max} jugadores
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    <span className="auth-badge">{votes} voto{votes !== 1 ? "s" : ""}</span>
                    {isMyVote && (
                      <span className="text-[10px] text-casino-gold">✓ Tu voto</span>
                    )}
                    {isLeading && votes > 0 && (
                      <span className="text-[10px] text-white/50">Liderando</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {isHost && (
            <div className="text-center space-y-2">
              <button
                className="auth-btn-primary max-w-xs mx-auto"
                disabled={actionLoading || totalVotes === 0}
                onClick={startGame}
              >
                {actionLoading ? "Iniciando..." : "▶ Iniciar Partida"}
              </button>
              {totalVotes === 0 && (
                <p className="text-xs text-white/40">Se necesita al menos un voto</p>
              )}
              {leadingGame && totalVotes > 0 && (
                <p className="text-xs text-white/40">
                  Se iniciará: {GAMES.find((g) => g.id === leadingGame)?.name}
                </p>
              )}
              {!leadingGame && totalVotes > 0 && (
                <p className="text-xs text-white/40">Empate — gana el voto del host</p>
              )}
            </div>
          )}

          {!isHost && (
            <p className="text-center text-xs text-white/40">
              {myVote
                ? "Esperando a que el host inicie la partida..."
                : "Selecciona un juego para votar"}
            </p>
          )}

          {actionError && <p className="auth-error">{actionError}</p>}
        </section>
      </div>
    </main>
  );
}
