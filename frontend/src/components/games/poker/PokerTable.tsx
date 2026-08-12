"use client";

import { useMemo, useState } from "react";
import type { PokerState, Room } from "@cg/backend/types";
import { CardSlot } from "@/components/cards/PlayingCard";
import { ActionBar, GameButton, StatusBanner } from "@/components/ui/GameButton";
import { GameLandscapeGate } from "@/components/ui/GameLandscapeGate";
import { CasinoChipStack } from "@/components/ui/CasinoChip";
import { DealtCardSpread } from "@/components/table/immersive/DealtCardSpread";
import { ImmersiveTableScene } from "@/components/table/immersive/ImmersiveTableScene";
import { HandsOverviewPanel, type HandOverviewEntry } from "@/components/table/immersive/HandsOverviewPanel";
import { orderPlayersFirstPerson } from "@/lib/table/seat-order";
import { useBetAnimations } from "@/hooks/useBetAnimations";
import type { BetAnimState } from "@/hooks/useBetAnimations";
import { useDealPlanContext, reorderHandPlayerIds } from "@/hooks/useProgressiveDeal";
import {
  buildPokerDealPlan,
  COMMUNITY_SLOT,
  playerSlot,
  resolveDealPlan,
} from "@/lib/table/deal-sequence";
import { TableCard } from "@/components/table/immersive/TableCard";
import { BRAND_ASSETS, BRAND_NAME } from "@/lib/brand";
import { BrandImageSlot } from "@/components/brand/BrandImageSlot";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { CardStylePicker } from "@/components/lobby/CardStylePicker";
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
      className={`live-table-bet-spot live-table-bet-spot--pos-${Math.min(position, 7)} ${isMe ? "live-table-bet-spot--me" : ""} live-table-bet-spot--sm ${betAnim ? "live-table-bet-spot--animating" : ""} ${betAnim?.mode === "add" ? "live-table-bet-spot--adding" : ""}`}
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
  slot,
  position,
  isMe,
  isTurn,
  folded,
  dealPlan,
  visibleGlobal,
  dealComplete,
}: {
  name: string;
  cards: PokerState["players"][0]["holeCards"];
  slot: string;
  position: number;
  isMe: boolean;
  isTurn: boolean;
  folded: boolean;
  dealPlan: ReturnType<typeof buildPokerDealPlan>;
  visibleGlobal: number;
  dealComplete: boolean;
}) {
  if (folded || cards.length === 0) return null;

  return (
    <div
      className={`live-seat-spot live-seat-spot--pos-${Math.min(position, 7)} ${isMe ? "live-seat-spot--me" : ""} ${isTurn ? "live-seat-spot--turn" : ""}`}
    >
      <span className="live-seat-spot__name">{isMe ? "Tú" : name}</span>
      <div className="live-seat-spot__cards">
        <DealtCardSpread
          cards={cards}
          slot={slot}
          plan={dealComplete ? null : dealPlan}
          visibleGlobal={visibleGlobal}
          complete={dealComplete}
          size={isMe ? "md" : "sm"}
          keyPrefix={`poker-${slot}`}
        />
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
  const orderedIds = orderedPlayers.map((p) => p.id);
  const dealOrderIds = reorderHandPlayerIds(
    state.players.map((p) => p.playerId),
    playerId
  );

  const dealPlan = useMemo(
    () => buildPokerDealPlan(state, dealOrderIds),
    [state, dealOrderIds]
  );

  const { visibleGlobal, complete: dealComplete, isDealing } = useDealPlanContext(
    state.dealStartedAt,
    state.dealCardCount,
    dealPlan
  );

  const communityVisible = resolveDealPlan(
    dealComplete ? null : dealPlan,
    state.communityCards,
    COMMUNITY_SLOT,
    visibleGlobal,
    dealComplete
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

  const myChips = room.players.find((p) => p.id === playerId)?.chips ?? 0;

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
        slot: playerSlot(p.id, 0),
        isMe: p.id === playerId,
        isActive: currentTurnId === p.id,
      });
    }

    if (state.communityCards.length > 0) {
      entries.push({
        id: "community",
        label: "Mesa",
        cards: state.communityCards,
        slot: COMMUNITY_SLOT,
        isDealer: true,
      });
    }

    return entries;
  }, [orderedPlayers, state.players, state.communityCards, playerId, currentTurnId]);

  return (
    <GameLandscapeGate>
      <div className="live-casino-root poker-table-root mobile-play-root">
        <div className="poker-style-picker-slot" aria-label="Estilo de cartas">
          <CardStylePicker />
        </div>
        <HandsOverviewPanel
          entries={handsOverviewEntries}
          dealPlan={dealPlan}
          visibleGlobal={visibleGlobal}
          dealComplete={dealComplete}
        />

        <ImmersiveTableScene>
          <div className={`live-table-scene ${isDealing ? "live-table-scene--dealing" : ""}`}>
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
                  <BrandLogo size="md" />
                  <span className="brand-table-logo-zone__name">{BRAND_NAME}</span>
                  <span className="poker-pot-badge">Bote {formatCurrency(state.pot)}</span>
                  <span className="poker-phase-badge">{PHASE[state.phase] ?? state.phase}</span>
                </div>

                <div className="live-felt-table-brand" aria-hidden>
                  CHOLOS GROUP
                </div>

                <div className="live-felt-zone live-felt-zone--dealer">
                  <div className="live-felt-card-spread">
                    {Array.from({ length: 5 }).map((_, i) => {
                      const card = communityVisible.visibleCards[i];
                      if (card) {
                        return (
                          <TableCard
                            key={`community-${i}-${card.rank}-${card.suit}`}
                            card={card}
                            index={0}
                            size="md"
                            variant="dealer"
                            motion={communityVisible.motionIndex === i ? "deal" : "none"}
                            animate={communityVisible.motionIndex === i}
                            className={
                              communityVisible.motionIndex === i
                                ? "live-table-card--dealing-now"
                                : undefined
                            }
                          />
                        );
                      }
                      return <CardSlot key={`slot-${i}`} size="md" />;
                    })}
                  </div>
                </div>

                {isDealing && (
                  <div className="live-dealing-flash" aria-hidden>
                    <span>
                      {state.dealCardCount
                        ? `Repartiendo ${visibleGlobal}/${state.dealCardCount}`
                        : "Repartiendo"}
                    </span>
                  </div>
                )}

                {orderedPlayers.map((p, index) => {
                  const ps = state.players.find((s) => s.playerId === p.id);
                  if (!ps) return null;
                  return (
                    <PokerSeatOnFelt
                      key={`seat-${p.id}`}
                      name={p.name}
                      cards={ps.holeCards}
                      slot={playerSlot(p.id, 0)}
                      position={index}
                      isMe={p.id === playerId}
                      isTurn={currentTurnId === p.id}
                      folded={ps.folded}
                      dealPlan={dealPlan}
                      visibleGlobal={visibleGlobal}
                      dealComplete={dealComplete}
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
          <div className="poker-controls-top">
            <StatusBanner message={statusMessage} type={isMyTurn ? "turn" : "info"} />
            <div className="live-bet-wallet live-bet-wallet--inline poker-wallet">
              <span className="live-bet-wallet__label">Tu saldo</span>
              <strong className="live-bet-wallet__amount">${myChips.toLocaleString("en-US")}</strong>
            </div>
          </div>
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
