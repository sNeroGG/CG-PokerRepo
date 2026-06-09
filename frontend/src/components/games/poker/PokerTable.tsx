"use client";

import { useState } from "react";
import type { PokerState, Room } from "@cg/backend/types";
import { PlayingCard, CardSlot } from "@/components/cards/PlayingCard";
import { GameTable } from "@/components/table/GameTable";
import { PlayerSeat } from "@/components/table/PlayerSeat";
import { ActionBar, GameButton, StatusBanner } from "@/components/ui/GameButton";
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
}: {
  room: Room;
  playerId: string;
  onUpdate: (room: Room) => void;
}) {
  const state = room.gameState as PokerState;
  const [raiseAmount, setRaiseAmount] = useState(state.currentBet + state.bigBlind);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isMyTurn =
    ["preflop", "flop", "turn", "river"].includes(state.phase) &&
    state.players[state.currentPlayerIndex]?.playerId === playerId;

  const canStart = ["waiting", "roundEnd", "showdown"].includes(state.phase);
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

  return (
    <div className="space-y-5">
      <GameTable label="Cartas comunitarias" gameName="TEXAS HOLD'EM">
        <div className="flex flex-col items-center gap-4">
          <div className="pot-display">
            <span>🪙</span>
            <span>Bote: ${state.pot}</span>
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
          <p className="text-center text-xs text-white/40">{state.dealerMessage}</p>
        </div>
      </GameTable>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {state.players.map((ps) => {
          const player = room.players.find((p) => p.id === ps.playerId);
          const isMe = ps.playerId === playerId;
          const isCurrent =
            state.players[state.currentPlayerIndex]?.playerId === ps.playerId;

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
              badge={ps.allIn ? "ALL-IN" : ps.lastAction?.toUpperCase()}
              footer={
                ps.lastAction ? (
                  <span className="text-[10px] uppercase text-white/30">{ps.lastAction}</span>
                ) : undefined
              }
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
            message={`🏆 ${player?.name} gana $${w.amount} — ${w.hand}`}
          />
        );
      })}

      <StatusBanner message={state.message} type={isMyTurn ? "turn" : "info"} />
      {error && <StatusBanner message={error} type="error" />}

      <ActionBar title={isMyTurn ? "Tu turno — elige acción" : undefined}>
        {canStart && (
          <GameButton
            variant="primary"
            label={state.phase === "waiting" ? "Iniciar Mano" : "Siguiente Mano"}
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
              className="input-field w-24 text-center"
            />
            <GameButton variant="raise" label="Subir" disabled={loading} onClick={() => act({ type: "raise", amount: raiseAmount })} />
            <GameButton variant="allin" label="All-In" disabled={loading} onClick={() => act({ type: "all-in" })} />
          </>
        )}
      </ActionBar>
    </div>
  );
}
