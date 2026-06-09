import type { GameType } from "../types";
import type { GameEngine, GameMeta } from "./engine";
import { blackjackEngine } from "./blackjack/engine";
import { pokerEngine } from "./poker/engine";

const engines: Record<GameType, GameEngine> = {
  blackjack: blackjackEngine,
  poker: pokerEngine,
};

export function getEngine(gameType: GameType): GameEngine {
  const engine = engines[gameType];
  if (!engine) throw new Error(`Unknown game type: ${gameType}`);
  return engine;
}

export function listGames(): GameMeta[] {
  return Object.values(engines).map((e) => ({
    id: e.id,
    name: e.name,
    description: e.description,
    minPlayers: e.minPlayers,
    maxPlayers: e.maxPlayers,
    icon: e.icon,
  }));
}

export { blackjackEngine, pokerEngine };
export type { GameEngine, GameMeta } from "./engine";
