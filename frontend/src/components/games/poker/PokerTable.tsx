"use client";

import { useMemo, useState } from "react";
import type { PokerState, Room } from "@cg/backend/types";
import { CardSlot } from "@/components/cards/PlayingCard";
import { ActionBar, GameButton, StatusBanner } from "@/components/ui/GameButton";
import { GameLandscapeGate } from "@/components/ui/GameLandscapeGate";
import { CasinoChipStack } from "@/components/ui/CasinoChip";
import { TableCard } from "@/components/table/immersive/TableCard";
import { ImmersiveTableScene } from "@/components/table/immersive/ImmersiveTableScene";
import { HandsOverviewPanel, type HandOverviewEntry } from "@/components/table/immersive/HandsOverviewPanel";
import { orderPlayersFirstPerson } from "@/lib/table/seat-order";
import { useBetAnimations } from "@/hooks/useBetAnimations";
import type { BetAnimState } from "@/hooks/useBetAnimations";
import { BRAND_ASSETS, BRAND_NAME } from "@/lib/brand";
import { BrandImageSlot } from "@/components/brand/BrandImageSlot";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { api } from "@/lib/client";
import "@/components/brand/brand-slots.css";
import "@/components/table/immersive/immersive-table.css";
import "@/components/ui/casino-chip.css";
import "@/components/games/blackjack/live-casino/live-casino.css";

const PHASE: Record<string, string> = {
  waiting: "Esperando",
  preflop: "Pre-Flop",
  flop: "Flop",
  turn: "Turn",
  river: "River",
  showdown: "Showdown",
  roundEnd: "Fin de mano",
};

function formatCurrency(amount: number) {
  return `$${amount.toLocaleString("en-US")}`;
}

function PokerBetSpot({
  amount,
  label,
  betAnim,
  position,
  isMe,
}: {
  amount: number;
  label: string;
  betAnim?: BetAnimState;
  position: number;
  isMe: boolean;
}) {
  if (amount <= 0) return null;

  const chipAnimate =
    betAnim?.mode === "fly" ? "fly-to-table" : betAnim?.mode === "add" ? "add-chips" : "none";

  return (
    <div
      className={`live-table-bet-spot live-table-bet-spot--pos-${Math.min(position, 5)} ${isMe ? "live-table-bet-spot--me" : ""} live-table-bet-spot--sm ${betAnim ? "live-table-bet-spot--animating" : ""} ${betAnim?.mode === "add" ? "live-table-bet-spot--adding" : ""}`}
    >
      <div className="live-table-bet-spot__ring" aria-hidden />
      <span className="live-table-bet-spot__label">{label}</span>
      <CasinoChipStack
        amount={amount}
        previousAmount={betAnim?.previousAmount ?? 0}
        size="sm"
        maxChips={4}
        animate={chipAnimate}
        className="live-table-bet-spot__stack"
      />
      <span className="live-table-bet-spot__total">{formatCurrency(amount)}</span>
    </div>
  );
}

function PokerSeatOnFelt({
  name,
  cards,
  position,
  isMe,
  isTurn,
  folded,
}: {
  name: string;
  cards: PokerState["players"][0]["holeCards"];
  position: number;
  isMe: boolean;
  isTurn: boolean;
  folded: boolean;
}) {
  if (folded || cards.length === 0) return null;

  return (
    <div
      className={`live-seat-spot live-seat-spot--pos-${Math.min(position, 5)} ${isMe ? "live-seat-spot--me" : ""} ${isTurn ? "live-seat-spot--turn" : ""}`}
    >
      <span className="live-seat-spot__name">{isMe ? "Tú" : name}</span>
      <div className="live-seat-spot__cards">
        {cards.map((card, i) => (
          <TableCard key={`${name}-${i}`} card={card} index={position * 2 + i} size={isMe ? "md" : "sm"} motion="deal" />
        ))}
      </div>
    </div>
  );
}

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

  const seatBets = useMemo(() => {
    const bets: Record<string, number> = {};
    for (const ps of state.players) {
      bets[ps.playerId] = ps.bet;
    }
    return bets;
  }, [state.players]);

  const betAnimations = useBetAnimations(seatBets);
  const orderedPlayers = orderPlayersFirstPerson(
    room.players.filter((p) => state.players.some((ps) => ps.playerId === p.id)),
    playerId
  );

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

  const handsOverviewEntries = useMemo((): HandOverviewEntry[] => {
    const entries: HandOverviewEntry[] = [];

    for (const p of orderedPlayers) {
      const ps = state.players.find((s) => s.playerId === p.id);
      if (!ps || ps.folded || ps.holeCards.length === 0) continue;

      entries.push({
        id: p.id,
        label: p.id === playerId ? "Mis cartas" : p.name,
        cards: ps.holeCards,
        isMe: p.id === playerId,
        isActive: currentTurnId === p.id,
      });
    }

    if (state.communityCards.length > 0) {
      entries.push({
        id: "community",
        label: "Mesa",
        cards: state.communityCards,
        isDealer: true,
      });
    }

    return entries;
  }, [orderedPlayers, state.players, state.communityCards, playerId, currentTurnId]);

  return (
    <GameLandscapeGate>
      <div className="live-casino-root poker-table-root landscape-play-root">
        <HandsOverviewPanel entries={handsOverviewEntries} />

        <ImmersiveTableScene>
          <div className="live-table-scene">
            <div className="live-table-wrapper">
              <div className="live-table-rail" />
              <div className="live-table-felt">
                <BrandImageSlot
                  src={BRAND_ASSETS.tableFelt}
                  className="brand-image-layer--felt"
                  placeholderLabel="FELT / MESA"
                />
                <BrandImageSlot
                  src={BRAND_ASSETS.tableWatermark}
                  className="brand-image-layer--watermark"
                  placeholderLabel="WATERMARK"
                  objectFit="contain"
                />
                <div className="brand-table-logo-zone">
                  <BrandLogo size="sm" />
                  <span className="brand-table-logo-zone__name">{BRAND_NAME}</span>
                  <span className="poker-pot-badge">Bote {formatCurrency(state.pot)}</span>
                  <span className="poker-phase-badge">{PHASE[state.phase] ?? state.phase}</span>
                </div>

                <div className="live-felt-zone live-felt-zone--dealer">
                  <div className="live-felt-card-spread">
                    {Array.from({ length: 5 }).map((_, i) => {
                      const card = state.communityCards[i];
                      return card ? (
                        <TableCard key={i} card={card} index={i} size="md" variant="dealer" motion="deal" />
                      ) : (
                        <CardSlot key={i} size="md" />
                      );
                    })}
                  </div>
                </div>

                {orderedPlayers.map((p, index) => {
                  const ps = state.players.find((s) => s.playerId === p.id);
                  if (!ps) return null;
                  return (
                    <PokerSeatOnFelt
                      key={`seat-${p.id}`}
                      name={p.name}
                      cards={ps.holeCards}
                      position={index}
                      isMe={p.id === playerId}
                      isTurn={currentTurnId === p.id}
                      folded={ps.folded}
                    />
                  );
                })}

                {orderedPlayers.map((p, index) => {
                  const ps = state.players.find((s) => s.playerId === p.id);
                  const bet = ps?.bet ?? 0;
                  if (!ps || bet <= 0) return null;
                  return (
                    <PokerBetSpot
                      key={`bet-${p.id}`}
                      amount={bet}
                      label={p.id === playerId ? "Tu apuesta" : p.name}
                      betAnim={betAnimations[p.id]}
                      position={index}
                      isMe={p.id === playerId}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </ImmersiveTableScene>

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

        <div className="poker-table-controls">
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
      </div>
    </GameLandscapeGate>
  );
}
