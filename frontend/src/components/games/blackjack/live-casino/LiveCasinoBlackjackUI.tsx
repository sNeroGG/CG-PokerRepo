"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BlackjackState, Card, Room } from "@cg/backend/types";
import { canSplitCards, handTotal, visibleDealerTotal } from "@/lib/game-logic/deck";
import { api } from "@/lib/client";
import { BRAND_ASSETS, BRAND_NAME } from "@/lib/brand";
import { BrandName } from "@/components/brand/BrandName";
import { BrandImageSlot } from "@/components/brand/BrandImageSlot";
import { BrandLogo } from "@/components/brand/BrandLogo";
import "@/components/brand/brand-slots.css";
import { useDealerRevealAnimation } from "./useDealerRevealAnimation";
import { GameLandscapeGate } from "@/components/ui/GameLandscapeGate";
import { groupChipStacks } from "@/lib/game-logic/chips";
import { CasinoChip, CasinoChipStack } from "@/components/ui/CasinoChip";
import { TableCard } from "@/components/table/immersive/TableCard";
import { ImmersiveTableScene } from "@/components/table/immersive/ImmersiveTableScene";
import { HandsOverviewPanel, type HandOverviewEntry } from "@/components/table/immersive/HandsOverviewPanel";
import { orderPlayersFirstPerson } from "@/lib/table/seat-order";
import { useBetAnimations } from "@/hooks/useBetAnimations";
import type { BetAnimState } from "@/hooks/useBetAnimations";
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

const REVEAL_GATED_STATUSES = new Set(["won", "lost", "push", "blackjack"]);

/** Oculta ganó/perdió hasta que el crupier termine de revelar sus cartas */
function visibleHandStatus(
  status: string | undefined,
  phase: string,
  revealComplete: boolean
): string | undefined {
  if (!status || status === "active") return undefined;
  if (phase === "roundEnd" && !revealComplete && REVEAL_GATED_STATUSES.has(status)) {
    return "Revelando cartas...";
  }
  return STATUS[status];
}

function neutralDealerMessage(
  dealerMessage: string,
  isRoundEnd: boolean,
  reveal: ReturnType<typeof useDealerRevealAnimation>
): string {
  if (!isRoundEnd || reveal.complete) return dealerMessage;
  return reveal.isAnimating ? "Sacando cartas..." : "Revelando carta oculta...";
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
        <BrandLogo size="sm" />
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
  position,
  isMe,
  isTurn,
  phase,
  cardOffset = 0,
}: {
  name: string;
  cards: Card[];
  position: number;
  isMe: boolean;
  isTurn: boolean;
  phase: string;
  cardOffset?: number;
}) {
  if (cards.length === 0 || phase === "betting") return null;

  const visibleTotal = cards.some((c) => !c.hidden) ? handTotal(cards) : null;

  return (
    <div
      className={`live-seat-spot live-seat-spot--pos-${Math.min(position, 5)} ${isMe ? "live-seat-spot--me" : ""} ${isTurn ? "live-seat-spot--turn" : ""}`}
    >
      <span className="live-seat-spot__name">{isMe ? "Tú" : name}</span>
      <div className="live-seat-spot__cards">
        {cards.map((card, i) => (
          <TableCard
            key={`${name}-${i}-${card.rank}-${card.suit}-${card.hidden}`}
            card={card}
            index={cardOffset + i}
            size={isMe ? "md" : "sm"}
            motion="deal"
          />
        ))}
      </div>
      {visibleTotal !== null && (
        <span className="live-seat-spot__total">{visibleTotal}</span>
      )}
    </div>
  );
}

/* ── Victory cards on felt ── */
function DealerHandOnFelt({
  cards,
  dealerMessage,
  total,
  partial,
  isAnimating,
  animatingCardIndex,
  flipHole,
}: {
  cards: Card[];
  dealerMessage: string;
  total: number;
  partial: boolean;
  isAnimating: boolean;
  animatingCardIndex: number | null;
  flipHole: boolean;
}) {
  return (
    <div className={`live-felt-zone live-felt-zone--dealer ${isAnimating ? "live-felt-zone--dealer-active" : ""}`}>
      <div className="live-dealer-badge live-dealer-badge--felt">
        <span>Crupier CPU</span>
        <small>
          {isAnimating ? "Sacando cartas..." : dealerMessage}
          {cards.length > 0 && (
            <> · {partial ? `Visible: ${total}` : `Total: ${total}`}</>
          )}
        </small>
      </div>
      {isAnimating && (
        <div className="live-dealer-draw-indicator" aria-live="polite">
          <span className="live-dealer-draw-dot" />
          Repartiendo carta por carta...
        </div>
      )}
      <div className="live-felt-card-spread">
        {cards.map((card, i) => {
          let motion: "deal" | "flip" | "draw" | "none" = "none";
          if (animatingCardIndex === i) {
            motion = flipHole && i === 1 ? "flip" : "draw";
          }
          return (
            <TableCard
              key={`d-${card.rank}-${card.suit}-${i}-${card.hidden}`}
              card={card}
              index={i}
              size="md"
              variant="dealer"
              animate={false}
              motion={motion}
            />
          );
        })}
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
      className={`live-table-bet-spot live-table-bet-spot--pos-${Math.min(position, 5)}
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
  dealerMessage,
  isRoundEnd,
  dealerReveal,
  betAnimations,
  room,
  playerId,
  currentTurnId,
}: {
  state: BlackjackState;
  dealerMessage: string;
  isRoundEnd: boolean;
  dealerReveal: ReturnType<typeof useDealerRevealAnimation>;
  betAnimations: Record<string, BetAnimState | undefined>;
  room: Room;
  playerId: string;
  currentTurnId: string | null;
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

  const dealerPartial =
    dealerReveal.isAnimating ||
    dealerReveal.displayedHand.some((c) => c.hidden);

  const activePlayers = orderPlayersFirstPerson(room.players, playerId);

  return (
    <ImmersiveTableScene>
    <div className={`live-table-scene ${dealingBurst ? "live-table-scene--dealing" : ""}`}>
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
          </div>

          {(state.phase === "dealing" || dealerReveal.isAnimating) && (
            <div className="live-dealing-flash" aria-hidden>
              <span>{dealerReveal.isAnimating ? "Crupier" : "Repartiendo"}</span>
            </div>
          )}

          {(state.dealerHand.length > 0 || state.phase === "betting") && (
            <DealerHandOnFelt
              cards={isRoundEnd ? dealerReveal.displayedHand : state.dealerHand}
              dealerMessage={neutralDealerMessage(dealerMessage, isRoundEnd, dealerReveal)}
              total={isRoundEnd ? dealerReveal.displayedTotal : (visibleDealerTotal(state.dealerHand)?.value ?? 0)}
              partial={
                isRoundEnd
                  ? dealerPartial
                  : (visibleDealerTotal(state.dealerHand)?.partial ?? false)
              }
              isAnimating={dealerReveal.isAnimating}
              animatingCardIndex={dealerReveal.animatingCardIndex}
              flipHole={dealerReveal.flipHole}
            />
          )}

          {state.phase === "betting" && state.dealerHand.length === 0 && (
            <span className="live-felt-placeholder live-felt-placeholder--center">
              Apuestas
            </span>
          )}

          {activePlayers.map((p, index) => {
            const ps = state.players.find((s) => s.playerId === p.id);
            const placedBet = ps?.hands.reduce((sum, hand) => sum + hand.bet, 0) ?? 0;
            const isMe = p.id === playerId;
            const isTurn = currentTurnId === p.id;
            const primaryHand = ps?.hands[ps.currentHandIndex ?? 0] ?? ps?.hands[0];
            const cards = primaryHand?.cards ?? [];

            return (
              <PlayerHandOnFelt
                key={`hand-${p.id}`}
                name={p.name}
                cards={cards}
                position={index}
                isMe={isMe}
                isTurn={isTurn}
                phase={state.phase}
                cardOffset={index * 2}
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
}) {
  const phase = state.phase;
  const isCompact = phase === "playerTurn" || phase === "dealerTurn" || phase === "roundEnd" || dealerAnimating;

  const statusLine =
    dealerAnimating
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

        <div className="live-betting-section">
          {!isCompact && phase === "betting" && canBet && (
            <div className="live-bet-status-row">
              <BetChipPreview amount={displayBet} />
              <div className="live-current-bet">
                Apuesta: <em>{formatCurrency(displayBet)}</em>
              </div>
            </div>
          )}

          {phase === "betting" && canBet && !betPlaced && (
            <div className="live-action-buttons">
              <button type="button" className="live-btn live-btn-primary" disabled={loading || displayBet < minBet || displayBet > chips} onClick={onBet}>
                Apostar {formatCurrency(displayBet)}
              </button>
              <button type="button" className="live-btn live-btn-increase" disabled={loading || displayBet + step > chips} onClick={onIncrease}>
                +{formatCurrency(step)}
              </button>
              <button type="button" className="live-btn live-btn-muted" disabled={loading || displayBet <= minBet} onClick={onDecrease}>
                −
              </button>
              <button type="button" className="live-btn live-btn-danger" disabled={loading} onClick={onClear}>
                Borrar
              </button>
            </div>
          )}

          {isWaitingTurn && (
            <p className="live-waiting-msg">Esperando a {currentTurnName}...</p>
          )}

          {isMyTurn && (
            <div className="live-action-buttons">
              <button type="button" className="live-btn live-btn-hit" disabled={loading} onClick={onHit}>Pedir</button>
              <button type="button" className="live-btn live-btn-stand" disabled={loading} onClick={onStand}>Plantarse</button>
              {showDouble && <button type="button" className="live-btn live-btn-double" disabled={loading} onClick={onDouble}>Doblar</button>}
              {showSplit && <button type="button" className="live-btn live-btn-split" disabled={loading} onClick={onSplit}>Dividir</button>}
              {showSurrender && <button type="button" className="live-btn live-btn-danger" disabled={loading} onClick={onSurrender}>Rendirse</button>}
            </div>
          )}

          {phase === "roundEnd" && !dealerAnimating && isHost && (
            <div className="live-action-buttons">
              <button type="button" className="live-btn live-btn-primary" disabled={loading} onClick={onNewRound}>
                Nueva ronda
              </button>
            </div>
          )}

          {phase === "roundEnd" && !dealerAnimating && !isHost && (
            <p className="live-waiting-msg">Esperando al host...</p>
          )}
        </div>
      </div>
    </div>
  );
}

function BrandHeaderBar({
  roomCode,
  copied,
  onCopy,
  onHome,
}: {
  roomCode: string;
  copied: boolean;
  onCopy: () => void;
  onHome: () => void;
}) {
  return (
    <header className="brand-header-bar">
      <div className="brand-header-bar__left">
        <BrandLogo size="sm" />
        <div>
          <p className="brand-header-bar__title">
            <BrandName variant="header" />
          </p>
          <p className="brand-header-bar__code">Sala {roomCode}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" className="brand-header-btn" onClick={onCopy}>
          {copied ? "✓ Copiado" : `📋 ${roomCode}`}
        </button>
        <button type="button" className="brand-header-btn" onClick={onHome}>
          ← Inicio
        </button>
      </div>
    </header>
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
  const dealerReveal = useDealerRevealAnimation(state);

  const handStatus = visibleHandStatus(activeHand?.status, state.phase, dealerReveal.complete);

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

  const showResultOverlay = isRoundEnd && dealerReveal.complete && !!myResult;

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
      <div className="live-casino-root landscape-play-root">
      <BrandHeaderBar
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

      <HandsOverviewPanel entries={handsOverviewEntries} />

      {showResultOverlay && myResult && <RoundResultOverlay result={myResult} />}

      <TableBackground
        state={state}
        dealerMessage={state.dealerMessage}
        isRoundEnd={isRoundEnd}
        dealerReveal={dealerReveal}
        betAnimations={betAnimations}
        room={room}
        playerId={playerId}
        currentTurnId={currentTurnId}
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
      />
    </div>
    </GameLandscapeGate>
  );
}
