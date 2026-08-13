"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BlackjackState, Card, Room } from "@cg/backend/types";
import { canSplitCards, handTotal, visibleDealerTotal } from "@/lib/game-logic/deck";
import { api } from "@/lib/client";
import { BRAND_ASSETS, BRAND_NAME } from "@/lib/brand";
import { BrandImageSlot } from "@/components/brand/BrandImageSlot";
import { BrandLogo } from "@/components/brand/BrandLogo";
import "@/components/brand/brand-slots.css";
import { useDealerRevealAnimation } from "./useDealerRevealAnimation";
import { LiveActionButton } from "./LiveActionButton";
import { HandTotalsTable, type HandTotalRow } from "./HandTotalsTable";
import { GameLandscapeGate } from "@/components/ui/GameLandscapeGate";
import { GameHeader } from "@/components/ui/GameHeader";
import { CircleDollarSign, Clock3, Minus, Plus, RotateCcw } from "lucide-react";
import { groupChipStacks } from "@/lib/game-logic/chips";
import { CasinoChip, CasinoChipStack } from "@/components/ui/CasinoChip";
import { TableCard } from "@/components/table/immersive/TableCard";
import { ImmersiveTableScene } from "@/components/table/immersive/ImmersiveTableScene";
import { HandsOverviewPanel, type HandOverviewEntry } from "@/components/table/immersive/HandsOverviewPanel";
import { orderPlayersFirstPerson } from "@/lib/table/seat-order";
import { useBetAnimations } from "@/hooks/useBetAnimations";
import type { BetAnimState } from "@/hooks/useBetAnimations";
import { DealtCardSpread } from "@/components/table/immersive/DealtCardSpread";
import { useProgressiveDeal, reorderHandPlayerIds } from "@/hooks/useProgressiveDeal";
import {
  buildBlackjackDealPlan,
  DEALER_SLOT,
  playerSlot,
  resolveDealPlan,
} from "@/lib/table/deal-sequence";
import "@/components/table/immersive/immersive-table.css";
import "@/components/ui/casino-chip.css";
import "./live-casino.css";

const BET_WINDOW_SECONDS = 30;
const STATUS: Record<string, string> = {
  active: "En juego",
  stood: "Plantado",
  busted: "Se pasó",
  blackjack: "¡Blackjack!",
  won: "Ganó",
  lost: "Perdió",
  push: "Empate",
  surrendered: "Rendido",
};

const REVEAL_GATED_STATUSES = new Set([
  "won",
  "lost",
  "push",
  "blackjack",
  "busted",
]);

/** Oculta ganó/perdió hasta terminar deal + reveal del crupier */
function visibleHandStatus(
  status: string | undefined,
  phase: string,
  animationsComplete: boolean
): string | undefined {
  if (!status || status === "active") return undefined;
  if (phase === "roundEnd" && !animationsComplete && REVEAL_GATED_STATUSES.has(status)) {
    return "Revelando cartas...";
  }
  return STATUS[status];
}

const RESULT_META: Record<
  string,
  { label: string; icon: string; tone: "win" | "lose" | "neutral" | "gold" }
> = {
  won: { label: "¡Ganaste!", icon: "✓", tone: "win" },
  blackjack: { label: "¡Blackjack!", icon: "★", tone: "gold" },
  push: { label: "Empate", icon: "=", tone: "neutral" },
  lost: { label: "Perdiste", icon: "✗", tone: "lose" },
  busted: { label: "Te pasaste", icon: "✗", tone: "lose" },
  surrendered: { label: "Rendido", icon: "½", tone: "neutral" },
  stood: { label: "Plantado", icon: "—", tone: "neutral" },
};

function formatCurrency(amount: number) {
  return `$${amount.toLocaleString("en-US")}`;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function betStep(minBet: number) {
  return Math.max(minBet, 100);
}

function payoutLabel(
  status: string,
  bet: number,
  payout: BlackjackState["blackjackPayout"]
): string {
  switch (status) {
    case "blackjack":
      return `+${formatCurrency(Math.floor(bet * (payout === "6:5" ? 2.2 : 2.5)))}`;
    case "won":
      return `+${formatCurrency(bet * 2)}`;
    case "push":
      return `±${formatCurrency(bet)}`;
    case "surrendered":
      return `+${formatCurrency(Math.floor(bet * 0.5))}`;
    case "lost":
    case "busted":
      return `-${formatCurrency(bet)}`;
    default:
      return "";
  }
}

interface HandResult {
  playerId: string;
  playerName: string;
  isMe: boolean;
  handIndex: number;
  handCount: number;
  cards: Card[];
  total: number;
  bet: number;
  status: string;
  payout: string;
}

/* ── Player Sidebar — stats compactos (cartas en mesa) ── */
function PlayerSidebar({
  playerName,
  chips,
  displayBet,
  handStatus,
  phase,
}: {
  playerName: string;
  chips: number;
  displayBet: number;
  handStatus?: string;
  phase: string;
}) {
  return (
    <aside className="live-player-sidebar live-player-sidebar--compact">
      <div className="live-sidebar-brand">
        <BrandLogo size="md" />
      </div>
      <div className="live-sidebar-header">
        <span className="live-sidebar-name">{playerName}</span>
        <span className="live-sidebar-you">Tu asiento</span>
      </div>

      {handStatus && handStatus !== "En juego" && phase !== "betting" && (
        <div
          className={`live-sidebar-status live-sidebar-status--${handStatus.replace(/[^a-z]/gi, "").toLowerCase()}${
            handStatus === "Revelando cartas..." ? " live-sidebar-status--revealing" : ""
          }`}
        >
          {handStatus}
        </div>
      )}

      <div className="live-sidebar-stats">
        <div className="live-sidebar-stat live-sidebar-stat--bet">
          <span className="live-sidebar-stat-label">Apuesta</span>
          <strong>{formatCurrency(displayBet)}</strong>
        </div>
        <div className="live-sidebar-stat">
          <span className="live-sidebar-stat-label">Fichas</span>
          <strong>{formatCurrency(chips)}</strong>
        </div>
      </div>
    </aside>
  );
}

function PlayerHandOnFelt({
  name,
  cards,
  slot,
  position,
  isMe,
  isTurn,
  phase,
  dealPlan,
  visibleGlobal,
  dealComplete,
  dealBatchKey,
}: {
  name: string;
  cards: Card[];
  slot: string;
  position: number;
  isMe: boolean;
  isTurn: boolean;
  phase: string;
  dealPlan: ReturnType<typeof buildBlackjackDealPlan>;
  visibleGlobal: number;
  dealComplete: boolean;
  dealBatchKey: string;
}) {
  if (cards.length === 0 || phase === "betting") return null;

  const { visibleCards } = resolveDealPlan(
    dealComplete ? null : dealPlan,
    cards,
    slot,
    visibleGlobal,
    dealComplete
  );
  const visibleTotal =
    visibleCards.some((c) => !c.hidden) ? handTotal(visibleCards) : null;

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
          keyPrefix={`seat-${slot}`}
          dealBatchKey={dealBatchKey}
        />
      </div>
      {visibleTotal !== null && visibleCards.length === cards.length && (
        <span className="live-seat-spot__total">{visibleTotal}</span>
      )}
    </div>
  );
}

/* ── Victory cards on felt ── */
function DealerHandOnFelt({
  cards,
  isAnimating,
  animatingCardIndex,
  flipHole,
  useProgressiveDeal: progressiveDealActive,
  dealPlan,
  visibleGlobal,
  dealComplete,
  revealStage,
  revealVisible,
  revealTotal,
}: {
  cards: Card[];
  isAnimating: boolean;
  animatingCardIndex: number | null;
  flipHole: boolean;
  useProgressiveDeal: boolean;
  dealPlan: ReturnType<typeof buildBlackjackDealPlan>;
  visibleGlobal: number;
  dealComplete: boolean;
  revealStage?: "idle" | "pause" | "flip" | "settle" | "draw" | "done";
  revealVisible?: number;
  revealTotal?: number;
}) {
  const revealLabel =
    revealStage === "flip"
      ? "Volteando carta oculta..."
      : revealStage === "settle"
        ? "Carta revelada"
      : revealStage === "draw" && revealTotal
        ? `Sacando carta ${revealVisible ?? 0}/${revealTotal}`
        : revealStage === "pause"
          ? "Revelando mano..."
          : "Sacando cartas...";

  return (
    <div
      className={`live-felt-zone live-felt-zone--dealer ${isAnimating ? "live-felt-zone--dealer-active" : ""}`}
      data-reveal-stage={revealStage}
    >
      {(isAnimating || (progressiveDealActive && !dealComplete)) && (
        <div className="live-dealer-draw-indicator" aria-live="polite">
          <span className="live-dealer-draw-dot" />
          {isAnimating ? revealLabel : "Repartiendo carta por carta..."}
        </div>
      )}
      <div className="live-felt-card-spread live-felt-card-spread--dealer">
        {progressiveDealActive && !isAnimating ? (
          <DealtCardSpread
            cards={cards}
            slot={DEALER_SLOT}
            plan={dealComplete ? null : dealPlan}
            visibleGlobal={visibleGlobal}
            complete={dealComplete}
            size="md"
            variant="dealer"
            keyPrefix="dealer"
            dealBatchKey={`dealer-${visibleGlobal}`}
          />
        ) : (
          cards.map((card, i) => {
            let motion: "deal" | "flip" | "draw" | "none" = "none";
            if (animatingCardIndex === i) {
              motion = flipHole && i === 1 ? "flip" : "draw";
            }
            const dealingNow = animatingCardIndex === i;
            return (
              <TableCard
                key={`d-${i}-${card.rank}-${card.suit}-${dealingNow ? motion : "set"}`}
                card={card}
                index={i}
                size="md"
                variant="dealer"
                animate={motion !== "none"}
                motion={motion}
                className={dealingNow ? "live-table-card--dealing-now" : ""}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

function RoundResultOverlay({ result }: { result: HandResult }) {
  const meta = RESULT_META[result.status];
  const tone = meta?.tone ?? "neutral";

  const headline =
    result.status === "won" || result.status === "blackjack"
      ? "Victoria"
      : result.status === "push"
        ? "Empate"
        : result.status === "lost" || result.status === "busted"
          ? "Derrota"
          : "Fin de ronda";

  return (
    <div className="live-result-overlay" role="status" aria-live="polite">
      <div className={`live-result-card live-result-card--${tone}`}>
        <p className="live-result-card__eyebrow">{headline}</p>
        {meta && (
          <>
            <p className="live-result-card__title">{meta.label}</p>
            {result.payout ? (
              <p className="live-result-card__payout">{result.payout}</p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function BetChipPreview({ amount }: { amount: number }) {
  const groups = groupChipStacks(amount);

  if (groups.length === 0) {
    return (
      <div className="live-digital-chips">
        <CasinoChip value={100} color="red" size="sm" />
      </div>
    );
  }

  return (
    <div className="live-digital-chips">
      {groups.map(({ denom, count }) => (
        <div key={denom.value} className="live-chip-pile">
          <div className="live-chip-pile-stack">
            {Array.from({ length: count }, (_, i) => (
              <CasinoChip
                key={i}
                value={denom.value}
                color={denom.color}
                label={denom.label}
                size="sm"
                stacked
                stackOffset={i * 5}
              />
            ))}
          </div>
          <span className="live-chip-pile-label">${denom.value}</span>
        </div>
      ))}
    </div>
  );
}

function TableBetSpot({
  amount,
  label,
  betAnim,
  position = 0,
  isMe = false,
  compact = false,
}: {
  amount: number;
  label: string;
  betAnim?: BetAnimState;
  position?: number;
  isMe?: boolean;
  compact?: boolean;
}) {
  if (amount <= 0) return null;

  const chipAnimate =
    betAnim?.mode === "fly"
      ? "fly-to-table"
      : betAnim?.mode === "add"
        ? "add-chips"
        : "none";

  return (
    <div
      className={`live-table-bet-spot live-table-bet-spot--pos-${Math.min(position, 7)}
        ${isMe ? "live-table-bet-spot--me" : ""}
        ${compact ? "live-table-bet-spot--sm" : ""}
        ${betAnim ? "live-table-bet-spot--animating" : ""}
        ${betAnim?.mode === "add" ? "live-table-bet-spot--adding" : ""}`}
    >
      <div className="live-table-bet-spot__ring" aria-hidden />
      <span className="live-table-bet-spot__label">{label}</span>
      <CasinoChipStack
        amount={amount}
        previousAmount={betAnim?.previousAmount ?? 0}
        size={compact ? "sm" : "md"}
        maxChips={compact ? 4 : 6}
        animate={chipAnimate}
        className="live-table-bet-spot__stack"
      />
      <span className="live-table-bet-spot__total">{formatCurrency(amount)}</span>
    </div>
  );
}

function TableBackground({
  state,
  isRoundEnd,
  dealerReveal,
  betAnimations,
  room,
  playerId,
  currentTurnId,
  dealPlan,
  visibleGlobal,
  dealComplete,
  isDealing,
}: {
  state: BlackjackState;
  isRoundEnd: boolean;
  dealerReveal: ReturnType<typeof useDealerRevealAnimation>;
  betAnimations: Record<string, BetAnimState | undefined>;
  room: Room;
  playerId: string;
  currentTurnId: string | null;
  dealPlan: ReturnType<typeof buildBlackjackDealPlan>;
  visibleGlobal: number;
  dealComplete: boolean;
  isDealing: boolean;
}) {
  const prevCardCount = useRef(0);
  const [dealingBurst, setDealingBurst] = useState(false);

  useEffect(() => {
    const count =
      state.dealerHand.length +
      state.players.reduce((n, p) => n + p.hands.reduce((h, hand) => h + hand.cards.length, 0), 0);
    if (count > prevCardCount.current) {
      setDealingBurst(true);
      const t = setTimeout(() => setDealingBurst(false), 1200);
      prevCardCount.current = count;
      return () => clearTimeout(t);
    }
    prevCardCount.current = count;
  }, [state.dealerHand.length, state.players]);

  const activePlayers = orderPlayersFirstPerson(room.players, playerId);

  const progressiveDealActive =
    !!dealPlan && !dealComplete && !dealerReveal.isAnimating;

  return (
    <ImmersiveTableScene>
    <div className={`live-table-scene ${isDealing || dealingBurst ? "live-table-scene--dealing" : ""}`}>
      <div className="live-dealer-badge live-dealer-badge--above-table" aria-hidden={false}>
        <span>Cholos Boss</span>
      </div>
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
          </div>

          <div className="live-felt-table-brand" aria-hidden>
            CHOLOS GROUP
          </div>

          {(isDealing || state.phase === "dealing" || dealerReveal.isAnimating) && (
            <div className="live-dealing-flash" aria-hidden>
              <span>
                {dealerReveal.isAnimating
                  ? dealerReveal.stage === "flip"
                    ? "Crupier · Volteando"
                    : `Crupier · ${dealerReveal.visibleCount}/${dealerReveal.totalCount}`
                  : isDealing && state.dealCardCount
                    ? `Repartiendo ${visibleGlobal}/${state.dealCardCount}`
                    : "Repartiendo"}
              </span>
            </div>
          )}

          {(state.dealerHand.length > 0 || state.phase === "betting") && (
            <DealerHandOnFelt
              cards={isRoundEnd ? dealerReveal.displayedHand : state.dealerHand}
              isAnimating={dealerReveal.isAnimating}
              animatingCardIndex={dealerReveal.animatingCardIndex}
              flipHole={dealerReveal.flipHole}
              useProgressiveDeal={progressiveDealActive}
              dealPlan={dealPlan}
              visibleGlobal={visibleGlobal}
              dealComplete={dealComplete}
              revealStage={dealerReveal.stage}
              revealVisible={dealerReveal.visibleCount}
              revealTotal={dealerReveal.totalCount}
            />
          )}

          {state.phase === "betting" && state.dealerHand.length === 0 && (
            <span className="live-felt-placeholder live-felt-placeholder--center">
              Apuestas
            </span>
          )}

          {activePlayers.map((p, index) => {
            const ps = state.players.find((s) => s.playerId === p.id);
            const isMe = p.id === playerId;
            const isTurn = currentTurnId === p.id;
            const primaryHand = ps?.hands[ps.currentHandIndex ?? 0] ?? ps?.hands[0];
            const cards = primaryHand?.cards ?? [];
            const slot = playerSlot(p.id, ps?.currentHandIndex ?? 0);

            return (
              <PlayerHandOnFelt
                key={`hand-${p.id}`}
                name={p.name}
                cards={cards}
                slot={slot}
                position={index}
                isMe={isMe}
                isTurn={isTurn}
                phase={state.phase}
                dealPlan={dealPlan}
                visibleGlobal={visibleGlobal}
                dealComplete={dealComplete}
                dealBatchKey={String(state.dealStartedAt ?? "none")}
              />
            );
          })}

          {activePlayers.map((p, index) => {
            const ps = state.players.find((s) => s.playerId === p.id);
            const placedBet = ps?.hands.reduce((sum, hand) => sum + hand.bet, 0) ?? 0;
            const isMe = p.id === playerId;

            if (placedBet <= 0 || (state.phase === "betting" && placedBet < state.minBet)) {
              return null;
            }

            return (
              <TableBetSpot
                key={`bet-${p.id}`}
                amount={placedBet}
                label={isMe ? "Tu apuesta" : p.name}
                betAnim={betAnimations[p.id]}
                position={index}
                isMe={isMe}
                compact={!isMe}
              />
            );
          })}
        </div>
      </div>
    </div>
    </ImmersiveTableScene>
  );
}

function ControlTablet({
  state,
  displayBet,
  seconds,
  shuffling,
  chips,
  step,
  minBet,
  canBet,
  betPlaced,
  isMyTurn,
  isWaitingTurn,
  currentTurnName,
  isHost,
  loading,
  error,
  onBet,
  onSetBet,
  onIncrease,
  onDecrease,
  onClear,
  onHit,
  onStand,
  onDouble,
  onSplit,
  onSurrender,
  onNewRound,
  showDouble,
  showSplit,
  showSurrender,
  dealerAnimating,
  isCardDealing = false,
  handTotals = [],
}: {
  state: BlackjackState;
  displayBet: number;
  seconds: number;
  shuffling: boolean;
  chips: number;
  step: number;
  minBet: number;
  canBet: boolean;
  betPlaced: boolean;
  isMyTurn: boolean;
  isWaitingTurn: boolean;
  currentTurnName: string | null;
  isHost: boolean;
  loading: boolean;
  error: string;
  onBet: () => void;
  onSetBet: (amount: number) => void;
  onIncrease: () => void;
  onDecrease: () => void;
  onClear: () => void;
  onHit: () => void;
  onStand: () => void;
  onDouble: () => void;
  onSplit: () => void;
  onSurrender: () => void;
  onNewRound: () => void;
  showDouble: boolean;
  showSplit: boolean;
  showSurrender: boolean;
  dealerAnimating: boolean;
  isCardDealing?: boolean;
  handTotals?: HandTotalRow[];
}) {
  const phase = state.phase;
  const isCompact = phase === "playerTurn" || phase === "dealerTurn" || phase === "roundEnd" || dealerAnimating;
  const betPresets = [
    { label: "Mínima", amount: minBet },
    { label: "¼ saldo", amount: Math.max(minBet, Math.floor(chips * 0.25 / step) * step) },
    { label: "½ saldo", amount: Math.max(minBet, Math.floor(chips * 0.5 / step) * step) },
    { label: "Máxima", amount: chips },
  ].filter(
    (preset, index, presets) =>
      preset.amount <= chips &&
      presets.findIndex((candidate) => candidate.amount === preset.amount) === index
  );

  const statusLine =
    isCardDealing
      ? "Repartiendo carta..."
      : dealerAnimating
      ? "Crupier revelando..."
      : phase === "betting" && canBet
        ? `Apostar · ${formatTime(seconds)}`
        : phase === "betting" && betPlaced
          ? "Esperando apuestas..."
          : phase === "playerTurn" && isMyTurn
            ? "Tu turno"
            : phase === "playerTurn" && currentTurnName
              ? `Turno de ${currentTurnName}`
              : phase === "dealing" || shuffling
                ? "Repartiendo..."
                : phase === "roundEnd"
                  ? "Fin de ronda"
                  : "En juego";

  return (
    <div className="live-tablet-overlay">
      <div
        className={`live-tablet-panel ${isCompact ? "live-tablet-panel--compact" : "live-tablet-panel--betting"}
        ${phase === "roundEnd" ? "live-tablet-panel--round-end" : ""}`}
      >
        {error && <div className="live-status-banner live-status-error">{error}</div>}

        <p className="live-turn-status">{statusLine}</p>

        {phase !== "betting" && <HandTotalsTable rows={handTotals} />}

        <div className="live-betting-section">
          {phase === "betting" && canBet && !betPlaced && (
            <div className="live-bet-panel">
              <div className="live-bet-panel__header">
                <div>
                  <span className="live-bet-panel__eyebrow">Mesa abierta</span>
                  <h2>Elige tu apuesta</h2>
                </div>
                <span className="live-bet-panel__minimum">
                  Mínimo {formatCurrency(minBet)}
                </span>
              </div>

              <div className="live-bet-panel__stats">
                <div className="live-bet-stat">
                  <span className="live-bet-stat__label">Saldo</span>
                  <strong className="live-bet-stat__value">{formatCurrency(chips)}</strong>
                </div>
                <div className="live-bet-stat live-bet-stat--accent">
                  <span className="live-bet-stat__label">Saldo restante</span>
                  <strong className="live-bet-stat__value">
                    {formatCurrency(Math.max(0, chips - displayBet))}
                  </strong>
                </div>
                {seconds > 0 && (
                  <div className="live-bet-stat live-bet-stat--timer">
                    <span className="live-bet-stat__label">
                      <Clock3 size={12} aria-hidden />
                      Tiempo
                    </span>
                    <strong className="live-bet-stat__value">{formatTime(seconds)}</strong>
                  </div>
                )}
              </div>

              <div className="live-bet-panel__composer">
                <LiveActionButton
                  className="live-bet-adjust"
                  disabled={loading || displayBet <= minBet}
                  onClick={onDecrease}
                  aria-label={`Restar ${formatCurrency(step)}`}
                >
                  <Minus size={20} aria-hidden />
                </LiveActionButton>
                <div className="live-bet-panel__preview">
                  <span className="live-bet-panel__amount-label">Tu apuesta</span>
                  <strong className="live-bet-panel__amount">{formatCurrency(displayBet)}</strong>
                  <BetChipPreview amount={displayBet} />
                </div>
                <LiveActionButton
                  className="live-bet-adjust live-btn-increase"
                  disabled={loading || displayBet + step > chips}
                  onClick={onIncrease}
                  aria-label={`Sumar ${formatCurrency(step)}`}
                >
                  <Plus size={20} aria-hidden />
                </LiveActionButton>
              </div>

              <div className="live-bet-presets" aria-label="Apuestas rápidas">
                {betPresets.map((preset) => (
                  <button
                    type="button"
                    key={preset.label}
                    className={displayBet === preset.amount ? "is-selected" : ""}
                    aria-pressed={displayBet === preset.amount}
                    disabled={loading}
                    onClick={() => onSetBet(preset.amount)}
                  >
                    <span>{preset.label}</span>
                    <strong>{formatCurrency(preset.amount)}</strong>
                  </button>
                ))}
              </div>

              <div className="live-bet-panel__actions">
                <button
                  type="button"
                  className="live-bet-reset"
                  disabled={loading || displayBet === minBet}
                  onClick={onClear}
                >
                  <RotateCcw size={15} aria-hidden />
                  Restablecer
                </button>
                <LiveActionButton
                  className="live-btn-primary live-btn--apostar"
                  disabled={loading || displayBet < minBet || displayBet > chips}
                  onClick={onBet}
                >
                  <CircleDollarSign size={19} aria-hidden />
                  Confirmar {formatCurrency(displayBet)}
                </LiveActionButton>
              </div>
            </div>
          )}

          {isWaitingTurn && (
            <p className="live-waiting-msg">Esperando a {currentTurnName}...</p>
          )}

          {isMyTurn && !isCardDealing && (
            <div
              className={`live-action-buttons live-action-buttons--turn${
                [showDouble, showSplit, showSurrender].filter(Boolean).length >= 2
                  ? " live-action-buttons--multi"
                  : ""
              }`}
            >
              <LiveActionButton className="live-btn-hit" disabled={loading} onClick={onHit}>
                Pedir
              </LiveActionButton>
              <LiveActionButton className="live-btn-stand" disabled={loading} onClick={onStand}>
                Plantarse
              </LiveActionButton>
              {showDouble && (
                <LiveActionButton className="live-btn-double" disabled={loading} onClick={onDouble}>
                  Doblar
                </LiveActionButton>
              )}
              {showSplit && (
                <LiveActionButton className="live-btn-split" disabled={loading} onClick={onSplit}>
                  Dividir
                </LiveActionButton>
              )}
              {showSurrender && (
                <LiveActionButton className="live-btn-danger" disabled={loading} onClick={onSurrender}>
                  Rendirse
                </LiveActionButton>
              )}
            </div>
          )}

          {phase === "roundEnd" && !dealerAnimating && !isCardDealing && isHost && (
            <div className="live-action-buttons">
              <LiveActionButton className="live-btn-primary" disabled={loading} onClick={onNewRound}>
                Nueva ronda
              </LiveActionButton>
            </div>
          )}

          {phase === "roundEnd" && !dealerAnimating && !isCardDealing && !isHost && (
            <p className="live-waiting-msg">Esperando al host...</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function LiveCasinoBlackjackUI({
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
  const state = room.gameState as BlackjackState;
  const myState = state.players.find((p) => p.playerId === playerId);
  const myPlayer = room.players.find((p) => p.id === playerId);
  const chips = myPlayer?.chips ?? 0;
  const step = betStep(state.minBet);

  const handIdx = myState?.currentHandIndex ?? 0;
  const activeHand = myState?.hands[handIdx];
  const myCards = activeHand?.cards ?? [];
  const committedBet = activeHand?.bet ?? 0;

  const isMyTurn =
    state.phase === "playerTurn" &&
    state.players[state.currentPlayerIndex]?.playerId === playerId &&
    activeHand?.status === "active";

  const currentTurnId = state.phase === "playerTurn"
    ? state.players[state.currentPlayerIndex]?.playerId
    : null;
  const currentTurnName = currentTurnId
    ? room.players.find((p) => p.id === currentTurnId)?.name ?? "Jugador"
    : null;
  const isWaitingTurn =
    state.phase === "playerTurn" && !isMyTurn && !!myState;

  const betPlaced = state.phase === "betting" && committedBet >= state.minBet;
  const canBet = state.phase === "betting" && !betPlaced;

  const [pendingBet, setPendingBet] = useState(() => Math.max(state.minBet, step));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(BET_WINDOW_SECONDS);
  const [copied, setCopied] = useState(false);

  const displayBet = state.phase === "betting" && !betPlaced ? pendingBet : committedBet;

  const seatBets = useMemo(() => {
    const bets: Record<string, number> = {};
    for (const ps of state.players) {
      bets[ps.playerId] = ps.hands.reduce((sum, hand) => sum + hand.bet, 0);
    }
    return bets;
  }, [state.players]);

  const betAnimations = useBetAnimations(seatBets);

  const shuffling = state.phase === "dealing";
  const isRoundEnd = state.phase === "roundEnd";

  const dealOrderIds = useMemo(
    () => reorderHandPlayerIds(state.players.map((p) => p.playerId), playerId),
    [state.players, playerId]
  );
  const dealPlan = useMemo(
    () => buildBlackjackDealPlan(state, dealOrderIds),
    [state, dealOrderIds]
  );
  const { visibleGlobal, complete: dealComplete, isDealing } = useProgressiveDeal(
    state.dealStartedAt,
    state.dealCardCount
  );

  const dealerReveal = useDealerRevealAnimation(state, {
    enabled: !state.dealCardCount || dealComplete,
  });

  const roundAnimationsDone =
    dealComplete && (!isRoundEnd || dealerReveal.complete);

  const handStatus = visibleHandStatus(
    activeHand?.status,
    state.phase,
    roundAnimationsDone
  );

  const showDouble = isMyTurn && myCards.length === 2 && chips >= committedBet;
  const showSplit = isMyTurn && canSplitCards(myCards) && (myState?.hands.length ?? 0) < 2 && !activeHand?.fromSplit && chips >= committedBet;
  const showSurrender = isMyTurn && state.allowSurrender && myCards.length === 2 && (myState?.hands.length ?? 0) === 1 && !activeHand?.fromSplit;

  const act = useCallback(
    async (action: Record<string, unknown>) => {
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
    },
    [room.code, playerId, onUpdate]
  );

  useEffect(() => {
    if (state.phase === "betting") {
      setPendingBet((b) => Math.min(Math.max(b, state.minBet), chips || state.minBet));
      setSeconds(BET_WINDOW_SECONDS);
    }
  }, [state.phase, state.minBet, chips]);

  useEffect(() => {
    if (state.phase !== "betting") return;
    const id = setInterval(() => setSeconds((s) => (s <= 0 ? BET_WINDOW_SECONDS : s - 1)), 1000);
    return () => clearInterval(id);
  }, [state.phase]);

  const onIncrease = useCallback(() => setPendingBet((b) => Math.min(b + step, chips)), [step, chips]);
  const onDecrease = useCallback(() => setPendingBet((b) => Math.max(state.minBet, b - step)), [step, state.minBet]);
  const onClear = useCallback(() => setPendingBet(state.minBet), [state.minBet]);
  const onBet = useCallback(() => act({ type: "bet", amount: pendingBet }), [act, pendingBet]);

  const myResult: HandResult | undefined = isRoundEnd && myState
    ? (() => {
        const hand = myState.hands[handIdx] ?? myState.hands[0];
        return {
          playerId,
          playerName: myPlayer?.name ?? "Jugador",
          isMe: true,
          handIndex: handIdx,
          handCount: myState.hands.length,
          cards: hand.cards.map((c) => ({ ...c, hidden: false })),
          total: handTotal(hand.cards),
          bet: hand.bet,
          status: hand.status,
          payout: payoutLabel(hand.status, hand.bet, state.blackjackPayout),
        };
      })()
    : undefined;

  const showResultOverlay =
    isRoundEnd && dealComplete && dealerReveal.complete && !!myResult;

  const handTotals = useMemo((): HandTotalRow[] => {
    const rows: HandTotalRow[] = [];

    const dealerCards = isRoundEnd ? dealerReveal.displayedHand : state.dealerHand;
    if (dealerCards.length > 0) {
      const dealerPartial = !isRoundEnd ? visibleDealerTotal(state.dealerHand) : null;
      rows.push({
        id: "dealer",
        label: "Crupier",
        cards: dealerCards,
        total: isRoundEnd
          ? dealerReveal.displayedTotal
          : dealerPartial?.value ?? null,
        status: isRoundEnd
          ? dealerReveal.complete
            ? "Listo"
            : "Revelando"
          : dealerPartial?.partial
            ? "Parcial"
            : "—",
        isDealer: true,
      });
    }

    for (const p of orderPlayersFirstPerson(room.players, playerId)) {
      const ps = state.players.find((s) => s.playerId === p.id);
      const hand = ps?.hands[ps?.currentHandIndex ?? 0] ?? ps?.hands[0];
      if (!hand?.cards.length) continue;
      rows.push({
        id: p.id,
        label: p.id === playerId ? "Tú" : p.name,
        cards: hand.cards,
        total: hand.cards.some((c) => !c.hidden) ? handTotal(hand.cards) : null,
        status: visibleHandStatus(hand.status, state.phase, roundAnimationsDone) ?? "—",
        isMe: p.id === playerId,
        isActive: currentTurnId === p.id,
      });
    }

    return rows;
  }, [
    room.players,
    playerId,
    state.players,
    state.dealerHand,
    state.phase,
    isRoundEnd,
    dealerReveal.displayedHand,
    dealerReveal.displayedTotal,
    dealerReveal.complete,
    currentTurnId,
    roundAnimationsDone,
  ]);

  const handsOverviewEntries = useMemo((): HandOverviewEntry[] => {
    const entries: HandOverviewEntry[] = [];

    for (const p of orderPlayersFirstPerson(room.players, playerId)) {
      const ps = state.players.find((s) => s.playerId === p.id);
      const hand = ps?.hands[ps?.currentHandIndex ?? 0] ?? ps?.hands[0];
      if (!hand?.cards.length) continue;

      entries.push({
        id: p.id,
        label: p.id === playerId ? "Mis cartas" : p.name,
        cards: hand.cards,
        slot: playerSlot(p.id, ps?.currentHandIndex ?? 0),
        isMe: p.id === playerId,
        isActive: currentTurnId === p.id,
      });
    }

    const dealerCards = isRoundEnd ? dealerReveal.displayedHand : state.dealerHand;
    if (dealerCards.length > 0) {
      entries.push({
        id: "dealer",
        label: "Crupier",
        cards: dealerCards,
        slot: DEALER_SLOT,
        isDealer: true,
        total: isRoundEnd
          ? dealerReveal.displayedTotal
          : (visibleDealerTotal(state.dealerHand)?.value ?? null),
      });
    }

    return entries;
  }, [
    room.players,
    playerId,
    state.players,
    state.dealerHand,
    isRoundEnd,
    dealerReveal.displayedHand,
    dealerReveal.displayedTotal,
    currentTurnId,
  ]);

  return (
    <GameLandscapeGate>
      <div className="live-casino-root mobile-play-root">
      <GameHeader
        roomCode={room.code}
        copied={copied}
        onCopy={() => {
          navigator.clipboard.writeText(room.code);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        onHome={() => window.location.assign("/")}
      />
      <div className="live-casino-ambient" aria-hidden />

      <div className="live-players-panel">
        {room.players
          .filter((p) => (p.seatStatus ?? "active") === "active")
          .map((p) => {
          const ps = state.players.find((s) => s.playerId === p.id);
          const bet = ps?.hands[0]?.bet ?? 0;
          const isMe = p.id === playerId;
          const isTurn = currentTurnId === p.id;
          return (
            <div key={p.id} className={`live-player-row ${isMe ? "is-me" : ""} ${isTurn ? "is-turn" : ""}`}>
              <span>{p.name}{isMe ? " (Tú)" : ""}{isTurn ? " ◀" : ""}</span>
              <span>{formatCurrency(p.chips)}</span>
              {state.phase === "betting" && ps && (
                <span className={bet >= state.minBet ? "live-bet-done" : "live-bet-pending"}>
                  {bet >= state.minBet ? "✓" : "…"}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <PlayerSidebar
        playerName={myPlayer?.name ?? "Jugador"}
        chips={chips}
        displayBet={displayBet}
        handStatus={handStatus}
        phase={state.phase}
      />

      <HandsOverviewPanel
        entries={handsOverviewEntries}
        dealPlan={dealerReveal.isAnimating ? null : dealPlan}
        visibleGlobal={visibleGlobal}
        dealComplete={dealComplete}
        dealBatchKey={String(state.dealStartedAt ?? "none")}
      />

      {showResultOverlay && myResult && <RoundResultOverlay result={myResult} />}

      <TableBackground
        state={state}
        isRoundEnd={isRoundEnd}
        dealerReveal={dealerReveal}
        betAnimations={betAnimations}
        room={room}
        playerId={playerId}
        currentTurnId={currentTurnId}
        dealPlan={dealPlan}
        visibleGlobal={visibleGlobal}
        dealComplete={dealComplete}
        isDealing={isDealing}
      />

      <ControlTablet
        state={state}
        displayBet={displayBet}
        seconds={seconds}
        shuffling={shuffling}
        chips={chips}
        step={step}
        minBet={state.minBet}
        canBet={canBet}
        betPlaced={betPlaced}
        isMyTurn={isMyTurn}
        isWaitingTurn={isWaitingTurn}
        currentTurnName={currentTurnName}
        isHost={isHost}
        loading={loading}
        error={error}
        onBet={onBet}
        onSetBet={(amount) => setPendingBet(Math.min(chips, Math.max(state.minBet, amount)))}
        onIncrease={onIncrease}
        onDecrease={onDecrease}
        onClear={onClear}
        onHit={() => act({ type: "hit" })}
        onStand={() => act({ type: "stand" })}
        onDouble={() => act({ type: "double" })}
        onSplit={() => act({ type: "split" })}
        onSurrender={() => act({ type: "surrender" })}
        onNewRound={() => act({ type: "newRound" })}
        showDouble={showDouble}
        showSplit={showSplit}
        showSurrender={showSurrender}
        dealerAnimating={dealerReveal.isAnimating}
        isCardDealing={isDealing}
        handTotals={handTotals}
      />
    </div>
    </GameLandscapeGate>
  );
}
