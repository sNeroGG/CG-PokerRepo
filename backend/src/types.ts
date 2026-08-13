export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Rank =
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K"
  | "A";

export interface Card {
  suit: Suit;
  rank: Rank;
  hidden?: boolean;
}

export type SeatStatus = "active" | "waiting" | "sitting-out";

export interface Player {
  id: string;
  name: string;
  chips: number;
  isHost: boolean;
  isConnected: boolean;
  joinedAt: number;
  /** active = en mesa; waiting = en sala de espera hasta la próxima ronda */
  seatStatus?: SeatStatus;
  /** Voto de juego en lobby (blackjack | poker) */
  gameVote?: GameType | null;
  /** Listo para iniciar (solo lobby) */
  isReady?: boolean;
  /** Última señal de presencia recibida por el servidor. */
  lastSeenAt?: number;
  /** Hash interno del token de sesión. Nunca se expone al cliente. */
  sessionTokenHash?: string;
}

export type GameType = "blackjack" | "poker";

export type RoomStatus = "lobby" | "playing" | "finished";

/** Estado de lobby — se guarda en rooms.game_state mientras status === "lobby" */
export interface LobbyState {
  lobbyVotes: Record<string, GameType>;
  /** playerId → listo para iniciar */
  readyByPlayer?: Record<string, boolean>;
}

export function isLobbyState(state: unknown): state is LobbyState {
  return (
    typeof state === "object" &&
    state !== null &&
    "lobbyVotes" in state &&
    typeof (state as LobbyState).lobbyVotes === "object"
  );
}

export interface Room {
  code: string;
  hostId: string;
  gameType: GameType | null;
  status: RoomStatus;
  players: Player[];
  gameState: GameState | LobbyState | null;
  createdAt: number;
  updatedAt: number;
  /** Versión de persistencia para compare-and-swap. */
  version: number;
}

export type GameState = BlackjackState | PokerState;

export interface BaseGameState {
  type: GameType;
  phase: string;
  message: string;
  dealerMessage: string;
  /** Timestamp — sincroniza reparto carta por carta en todos los clientes */
  dealStartedAt?: number;
  /** Cuántas cartas se reparten en este batch (una animación por carta) */
  dealCardCount?: number;
  /** Orden de slots repartidos en este batch (ej. p:uuid:0) */
  dealSlots?: string[];
}

// ─── Blackjack ───────────────────────────────────────────────

export type BlackjackPhase =
  | "betting"
  | "dealing"
  | "playerTurn"
  | "dealerTurn"
  | "roundEnd";

export interface BlackjackHand {
  cards: Card[];
  bet: number;
  status:
    | "active"
    | "stood"
    | "busted"
    | "blackjack"
    | "won"
    | "lost"
    | "push"
    | "surrendered";
  payoutDone?: boolean;
  /** Mano creada por split — no permite rendirse */
  fromSplit?: boolean;
}

export interface BlackjackPlayerState {
  playerId: string;
  hands: BlackjackHand[];
  currentHandIndex: number;
}

export interface BlackjackState extends BaseGameState {
  type: "blackjack";
  phase: BlackjackPhase;
  deck: Card[];
  dealerHand: Card[];
  players: BlackjackPlayerState[];
  currentPlayerIndex: number;
  minBet: number;
  /** Pago blackjack natural 3:2 */
  blackjackPayout: "3:2" | "6:5";
  /** Rendición temprana disponible (50% de apuesta) */
  allowSurrender: boolean;
  /** Timestamp servidor — sincroniza animación del crupier en todos los clientes */
  dealerRevealAt?: number;
}

// ─── Poker (Texas Hold'em) ───────────────────────────────────

export type PokerPhase =
  | "waiting"
  | "preflop"
  | "flop"
  | "turn"
  | "river"
  | "showdown"
  | "roundEnd";

export type PokerActionType =
  | "fold"
  | "check"
  | "call"
  | "raise"
  | "all-in";

export interface PokerAction {
  type: PokerActionType;
  amount?: number;
}

export interface PokerPlayerState {
  playerId: string;
  holeCards: Card[];
  bet: number;
  totalBet: number;
  folded: boolean;
  allIn: boolean;
  lastAction: PokerActionType | null;
  /** Fichas disponibles durante la mano; fuente de verdad del stack. */
  stack: number;
  /** Indica si el jugador respondió desde el último raise completo. */
  acted: boolean;
}

export interface PokerPot {
  amount: number;
  eligiblePlayerIds: string[];
}

export interface PokerState extends BaseGameState {
  type: "poker";
  phase: PokerPhase;
  deck: Card[];
  communityCards: Card[];
  players: PokerPlayerState[];
  pot: number;
  currentBet: number;
  currentPlayerIndex: number;
  dealerIndex: number;
  smallBlind: number;
  bigBlind: number;
  winners: { playerId: string; amount: number; hand: string }[];
  winnersPaid?: boolean;
  pots: PokerPot[];
  lastFullRaise: number;
  smallBlindIndex: number;
  bigBlindIndex: number;
  turnStartedAt?: number;
  turnDeadlineAt?: number;
}

export interface GameActionPayload {
  type: string;
  [key: string]: unknown;
}
