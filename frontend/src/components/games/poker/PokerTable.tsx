"use client";

import { useState } from "react";
import type { PokerState, Room } from "@cg/backend/types";
import { PlayingCard, CardSlot } from "@/components/cards/PlayingCard";
import { GameTable } from "@/components/table/GameTable";
import { PlayerSeat } from "@/components/table/PlayerSeat";
import { ActionBar, GameButton, StatusBanner } from "@/components/ui/GameButton";
import { LandscapeToggle } from "@/components/ui/LandscapeToggle";
import { dealDelay } from "@/lib/game-logic/animations";
import { api } from "@/lib/client";

const PHASE: Record<string, string> = {
  waiting: "Esperando",
  preflop: "Pre-Flop",
  flop: "Flop",
  turn: "Turn",
  river: "River",
  showdown: "Showdown",
  roundEnd: "Fin de mano",
};

export function PokerTable({
  room,
  playerId,
  onUpdate,
  isHost = false,
}: {
  room: Room;
  playerId: string;
  onUpdate: (room: Room) => void;
  isHost?: boolean;
}) {
  const state = room.gameState as PokerState;
  const [raiseAmount, setRaiseAmount] = useState(state.currentBet + state.bigBlind);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const currentTurnId = ["preflop", "flop", "turn", "river"].includes(state.phase)
    ? state.players[state.currentPlayerIndex]?.playerId
    : null;
  const currentTurnName = currentTurnId
    ? room.players.find((p) => p.id === currentTurnId)?.name ?? "Jugador"
    : null;

  const isMyTurn = currentTurnId === playerId;
  const isWaitingTurn = !!currentTurnId && !isMyTurn;
  const canStart = isHost && ["waiting", "roundEnd", "showdown"].includes(state.phase);
  const myBet = state.players.find((p) => p.playerId === playerId)?.bet ?? 0;
  const toCall = state.currentBet - myBet;

  async function act(action: Record<string, unknown>) {
    setLoading(true);
    setError("");
    try {
      const { room: updated } = await api<{ room: Room }>(
        `/api/rooms/${room.code}/action`,
        { method: "POST", body: JSON.stringify({ playerId, action }) }
      );
      onUpdate(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  const statusMessage = isMyTurn
    ? "Tu turno"
    : isWaitingTurn
      ? `Turno de ${currentTurnName}`
      : canStart
        ? "Inicia la siguiente mano"
        : ["waiting", "roundEnd", "showdown"].includes(state.phase)
          ? "Esperando al host..."
          : state.message;

  return (
    <>
      <LandscapeToggle />
      <div className="poker-table-root landscape-play-root space-y-4">
      <GameTable label="" gameName="Texas Hold'em">
        <div className="flex flex-col items-center gap-3">
          <div className="pot-display">
            <span>Bote ${state.pot}</span>
          </div>
          <div className="community-row">
            {Array.from({ length: 5 }).map((_, i) => {
              const card = state.communityCards[i];
              return card ? (
                <PlayingCard key={i} card={card} size="md" delay={dealDelay(i)} />
              ) : (
                <CardSlot key={i} size="md" />
              );
            })}
          </div>
          <span className="phase-badge">{PHASE[state.phase] ?? state.phase}</span>
        </div>
      </GameTable>

      <div className="poker-seats-grid grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {state.players.map((ps) => {
          const player = room.players.find((p) => p.id === ps.playerId);
          const isMe = ps.playerId === playerId;
          const isCurrent = currentTurnId === ps.playerId;

          return (
            <PlayerSeat
              key={ps.playerId}
              name={player?.name ?? "Jugador"}
              chips={player?.chips ?? 0}
              cards={ps.holeCards}
              bet={ps.bet}
              isMe={isMe}
              isActive={isCurrent}
              isFolded={ps.folded}
              badge={ps.allIn ? "ALL-IN" : isCurrent ? "TURNO" : ps.lastAction?.toUpperCase()}
            />
          );
        })}
      </div>

      {state.winners.map((w) => {
        const player = room.players.find((p) => p.id === w.playerId);
        return (
          <StatusBanner
            key={w.playerId}
            type="success"
            message={`${player?.name} gana $${w.amount} — ${w.hand}`}
          />
        );
      })}

      <StatusBanner message={statusMessage} type={isMyTurn ? "turn" : "info"} />
      {error && <StatusBanner message={error} type="error" />}

      <ActionBar title={isMyTurn ? "Tu turno" : undefined}>
        {canStart && (
          <GameButton
            variant="primary"
            label={state.phase === "waiting" ? "Iniciar mano" : "Siguiente mano"}
            disabled={loading}
            onClick={() => act({ type: "startHand" })}
          />
        )}
        {isMyTurn && (
          <>
            <GameButton variant="fold" label="Retirarse" disabled={loading} onClick={() => act({ type: "fold" })} />
            {toCall === 0 ? (
              <GameButton variant="check" label="Pasar" disabled={loading} onClick={() => act({ type: "check" })} />
            ) : (
              <GameButton variant="call" label={`Igualar $${toCall}`} disabled={loading} onClick={() => act({ type: "call" })} />
            )}
            <input
              type="number"
              min={state.currentBet + state.bigBlind}
              value={raiseAmount}
              onChange={(e) => setRaiseAmount(Number(e.target.value))}
              className="input-field w-20 text-center sm:w-24"
            />
            <GameButton variant="raise" label="Subir" disabled={loading} onClick={() => act({ type: "raise", amount: raiseAmount })} />
            <GameButton variant="allin" label="All-In" disabled={loading} onClick={() => act({ type: "all-in" })} />
          </>
        )}
        {isWaitingTurn && (
          <p className="w-full text-center text-sm text-white/50">
            Esperando a {currentTurnName}...
          </p>
        )}
      </ActionBar>
      </div>
    </>
  );
}
