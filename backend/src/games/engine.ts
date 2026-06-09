import type { GameActionPayload, GameState, GameType, Player } from "../types";

export interface GameEngine<T extends GameState = GameState> {
  readonly id: GameType;
  readonly name: string;
  readonly description: string;
  readonly minPlayers: number;
  readonly maxPlayers: number;
  readonly icon: string;

  createInitialState(players: Player[]): T;
  getValidActions(state: T, playerId: string): GameActionPayload[];
  applyAction(state: T, playerId: string, action: GameActionPayload): T;
  isRoundOver(state: T): boolean;
  getPublicState(state: T, viewerId?: string): T;
}

export interface GameMeta {
  id: GameType;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  icon: string;
}
