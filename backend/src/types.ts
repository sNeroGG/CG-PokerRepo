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

export type SeatStatus = "active" | "waiting";

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
}

export type GameType = "blackjack" | "poker";

export type RoomStatus = "lobby" | "playing" | "finished";

export interface Room {
  code: string;
  hostId: string;
  gameType: GameType | null;
  status: RoomStatus;
  players: Player[];
  gameState: GameState | null;
  createdAt: number;
  updatedAt: number;
}

export type GameState = BlackjackState | PokerState;

export interface BaseGameState {
  type: GameType;
  phase: string;
  message: string;
  dealerMessage: string;
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
}

export interface GameActionPayload {
  type: string;
  [key: string]: unknown;
}
