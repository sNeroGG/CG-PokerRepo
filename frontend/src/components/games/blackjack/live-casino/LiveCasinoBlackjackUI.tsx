"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BlackjackState, Card, Room } from "@cg/backend/types";
import { canSplitCards, handTotal, SUIT_SYMBOL, visibleDealerTotal } from "@/lib/game-logic/deck";
import { isRedSuit } from "@/lib/game-logic/card-utils";
import { api } from "@/lib/client";
import { BRAND_ASSETS, BRAND_NAME, BRAND_NAME_SHORT } from "@/lib/brand";
import { BrandName } from "@/components/brand/BrandName";
import { BrandImageSlot } from "@/components/brand/BrandImageSlot";
import { BrandLogo } from "@/components/brand/BrandLogo";
import "@/components/brand/brand-slots.css";
import { useDealerRevealAnimation } from "./useDealerRevealAnimation";
import { LandscapeToggle } from "@/components/ui/LandscapeToggle";
import { groupChipStacks, getChipColorForValue } from "@/lib/game-logic/chips";
import { CasinoChip, CasinoChipStack } from "@/components/ui/CasinoChip";
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

/* ── Table Card — frontal con ligera diagonal ── */
function TableCard({
  card,
  index = 0,
  size = "md",
  animate = true,
  variant = "default",
  motion = "deal",
}: {
  card: Card;
  index?: number;
  size?: "sm" | "md" | "lg";
  animate?: boolean;
  variant?: "default" | "victory" | "dealer";
  motion?: "deal" | "flip" | "draw" | "none";
}) {
  const isHidden = card.hidden;
  const color = isHidden ? "" : isRedSuit(card.suit) ? "red" : "black";

  const motionClass =
    motion === "flip"
      ? "live-table-card--flip"
      : motion === "draw"
        ? "live-table-card--draw"
        : animate
          ? "live-table-card--deal"
          : "";

  return (
    <div
      className={`live-table-card live-table-card--${size} live-table-card--${variant} ${motionClass} ${isHidden ? "live-table-card--back" : `live-table-card--${color}`}`}
      style={{
        animationDelay:
          motion === "deal" && animate ? `${index * 0.18}s` : undefined,
        zIndex: index,
      }}
    >
      <div className="live-table-card-inner">
        {isHidden ? (
          <span className="live-table-card-logo">{BRAND_NAME_SHORT}</span>
        ) : (
          <>
            <span className="live-table-card-rank">{card.rank}</span>
            <span className="live-table-card-suit">{SUIT_SYMBOL[card.suit]}</span>
            <span className="live-table-card-rank live-table-card-rank--bl">{card.rank}</span>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Player Sidebar — cartas + apuesta al costado ── */
function PlayerSidebar({
  playerName,
  chips,
  displayBet,
  myCards,
  handTotalValue,
  handStatus,
  handIndex,
  handCount,
  phase,
  allHands,
}: {
  playerName: string;
  chips: number;
  displayBet: number;
  myCards: Card[];
  handTotalValue: number | null;
  handStatus?: string;
  handIndex: number;
  handCount: number;
  phase: string;
  allHands?: Array<{ cards: Card[]; bet: number; status: string }>;
}) {
  const showHands = phase !== "betting" && (allHands?.length ?? 0) > 0;

  return (
    <aside className="live-player-sidebar">
      <div className="live-sidebar-brand">
        <BrandLogo size="sm" />
      </div>
      <div className="live-sidebar-header">
        <span className="live-sidebar-name">{playerName}</span>
        <span className="live-sidebar-you">Tu mano</span>
      </div>

      <div className="live-sidebar-cards">
        {showHands && allHands ? (
          allHands.map((hand, hi) => (
            <div key={hi} className={`live-sidebar-hand ${hi === handIndex ? "is-active" : ""}`}>
              {handCount > 1 && <span className="live-sidebar-hand-label">Mano {hi + 1}</span>}
              <div className="live-sidebar-card-row">
                {hand.cards.map((card, ci) => (
                  <TableCard key={`sb-${hi}-${ci}`} card={card} index={ci + hi * 2} size="lg" />
                ))}
              </div>
              {hand.cards.some((c) => !c.hidden) && (
                <span className="live-sidebar-hand-total">{handTotal(hand.cards)}</span>
              )}
            </div>
          ))
        ) : myCards.length > 0 ? (
          <div className="live-sidebar-hand is-active">
            <div className="live-sidebar-card-row">
              {myCards.map((card, i) => (
                <TableCard key={`sb-${i}`} card={card} index={i} size="lg" />
              ))}
            </div>
            {handTotalValue !== null && (
              <span className="live-sidebar-hand-total">{handTotalValue}</span>
            )}
          </div>
        ) : (
          <div className="live-sidebar-empty">
            <div className="live-sidebar-empty-card" />
            <div className="live-sidebar-empty-card" />
            <span>Esperando cartas...</span>
          </div>
        )}
      </div>

      {handStatus && handStatus !== "En juego" && (
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
        {handTotalValue !== null && phase !== "betting" && (
          <div className="live-sidebar-stat live-sidebar-stat--total">
            <span className="live-sidebar-stat-label">Total</span>
            <strong>{handTotalValue}</strong>
          </div>
        )}
      </div>
    </aside>
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

function RackChipSlice({ value }: { value: number }) {
  const color = getChipColorForValue(value);
  return (
    <div className={`live-rack-chip live-rack-chip--${color}`}>
      <span className="live-rack-chip__inlay" aria-hidden />
    </div>
  );
}

function ChipRack({ side }: { side: "left" | "right" }) {
  const rackValues =
    side === "left"
      ? [100, 100, 500, 500, 1000]
      : [500, 100, 1000, 500, 100, 100];

  return (
    <div className={`live-chip-racks ${side}`}>
      <div className="live-chip-rack">
        <div className="live-chip-rack-tray">
          {rackValues.map((value, i) => (
            <RackChipSlice key={`${side}-${value}-${i}`} value={value} />
          ))}
        </div>
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
  animating,
}: {
  amount: number;
  animating: boolean;
}) {
  if (amount <= 0) return null;

  return (
    <div className={`live-table-bet-spot ${animating ? "live-table-bet-spot--animating" : ""}`}>
      <div className="live-table-bet-spot__ring" aria-hidden />
      <span className="live-table-bet-spot__label">Tu apuesta</span>
      <CasinoChipStack
        amount={amount}
        size="md"
        maxChips={6}
        animate={animating ? "fly-to-table" : "none"}
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
  tableBetAmount,
  betAnimating,
}: {
  state: BlackjackState;
  dealerMessage: string;
  isRoundEnd: boolean;
  dealerReveal: ReturnType<typeof useDealerRevealAnimation>;
  tableBetAmount: number;
  betAnimating: boolean;
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

  return (
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

          {tableBetAmount > 0 && !isRoundEnd && (
            <TableBetSpot amount={tableBetAmount} animating={betAnimating} />
          )}

          <ChipRack side="left" />
          <ChipRack side="right" />
        </div>
      </div>
    </div>
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
      <div className={`live-tablet-panel ${isCompact ? "live-tablet-panel--compact" : ""} ${phase === "roundEnd" ? "live-tablet-panel--round-end" : ""}`}>
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
  const allMyHands = myState?.hands ?? [];

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
  const [betAnimating, setBetAnimating] = useState(false);
  const prevCommittedBetRef = useRef(0);

  const displayBet = state.phase === "betting" && !betPlaced ? pendingBet : committedBet;
  const handTotalValue = myCards.length > 0 ? handTotal(myCards) : null;

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

  useEffect(() => {
    if (state.phase !== "betting") {
      prevCommittedBetRef.current = committedBet;
      setBetAnimating(false);
      return;
    }

    if (committedBet >= state.minBet && committedBet > prevCommittedBetRef.current) {
      setBetAnimating(true);
      const t = setTimeout(() => setBetAnimating(false), 1100);
      prevCommittedBetRef.current = committedBet;
      return () => clearTimeout(t);
    }

    prevCommittedBetRef.current = committedBet;
  }, [committedBet, state.phase, state.minBet]);

  const tableBetAmount =
    committedBet >= state.minBet &&
    (state.phase !== "betting" || betPlaced || betAnimating)
      ? committedBet
      : 0;

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

  return (
    <>
      <LandscapeToggle />
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
        myCards={myCards}
        handTotalValue={handTotalValue}
        handStatus={handStatus}
        handIndex={handIdx}
        handCount={myState?.hands.length ?? 1}
        phase={state.phase}
        allHands={allMyHands.map((h) => ({ cards: h.cards, bet: h.bet, status: h.status }))}
      />

      {showResultOverlay && myResult && <RoundResultOverlay result={myResult} />}

      <TableBackground
        state={state}
        dealerMessage={state.dealerMessage}
        isRoundEnd={isRoundEnd}
        dealerReveal={dealerReveal}
        tableBetAmount={tableBetAmount}
        betAnimating={betAnimating}
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
    </>
  );
}
