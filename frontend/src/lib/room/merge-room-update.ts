import type {
  BlackjackState,
  Card,
  PokerState,
  Room,
} from "@cg/backend/types";
import { isLobbyState } from "@cg/backend/types";

export type MergeRoomResult = {
  room: Room;
  /** Nueva mano / cartas propias ocultas: hace falta GET personalizado */
  needsPrivateRefetch: boolean;
};

function cardsKnown(cards: Card[]): boolean {
  return cards.some((c) => !c.hidden && Boolean(c.rank));
}

function cardsAllHidden(cards: Card[]): boolean {
  return cards.length > 0 && cards.every((c) => c.hidden);
}

function mergePokerPrivate(
  prev: PokerState,
  next: PokerState,
  viewerId: string
): { state: PokerState; needsPrivateRefetch: boolean } {
  const prevMe = prev.players.find((p) => p.playerId === viewerId);
  const nextPlayers = next.players.map((ps) => {
    if (ps.playerId !== viewerId) return ps;
    const prevHole = prevMe?.holeCards ?? [];
    const sameDeal = prev.dealStartedAt === next.dealStartedAt;
    if (sameDeal && cardsAllHidden(ps.holeCards) && cardsKnown(prevHole)) {
      return { ...ps, holeCards: prevHole };
    }
    return ps;
  });

  const me = nextPlayers.find((p) => p.playerId === viewerId);
  const needsPrivateRefetch = Boolean(
    me &&
      me.holeCards.length > 0 &&
      cardsAllHidden(me.holeCards) &&
      !(
        prev.dealStartedAt === next.dealStartedAt &&
        prevMe &&
        cardsKnown(prevMe.holeCards)
      )
  );

  return { state: { ...next, players: nextPlayers }, needsPrivateRefetch };
}

function mergeBlackjackPrivate(
  prev: BlackjackState,
  next: BlackjackState,
  viewerId: string
): { state: BlackjackState; needsPrivateRefetch: boolean } {
  const prevMe = prev.players.find((p) => p.playerId === viewerId);
  const nextPlayers = next.players.map((ps) => {
    if (ps.playerId !== viewerId) return ps;
    const prevHands = prevMe?.hands ?? [];
    const sameDeal = prev.dealStartedAt === next.dealStartedAt;
    if (!sameDeal) return ps;

    return {
      ...ps,
      hands: ps.hands.map((hand, i) => {
        const prevCards = prevHands[i]?.cards ?? [];
        if (cardsAllHidden(hand.cards) && cardsKnown(prevCards)) {
          return { ...hand, cards: prevCards };
        }
        return hand;
      }),
    };
  });

  const me = nextPlayers.find((p) => p.playerId === viewerId);
  const needsPrivateRefetch = Boolean(
    me?.hands.some(
      (hand, i) =>
        hand.cards.length > 0 &&
        cardsAllHidden(hand.cards) &&
        !(
          prev.dealStartedAt === next.dealStartedAt &&
          prevMe?.hands[i] &&
          cardsKnown(prevMe.hands[i].cards)
        )
    )
  );

  return { state: { ...next, players: nextPlayers }, needsPrivateRefetch };
}

/**
 * Fusiona un snapshot compartido (Broadcast, sin cartas privadas) con el estado
 * local del viewer. Si hay nueva mano sin cartas conocidas, pide refetch.
 */
export function mergeRoomUpdate(
  prev: Room | null,
  incoming: Room,
  viewerId: string
): MergeRoomResult {
  if (!prev?.gameState || !incoming.gameState) {
    const needsPrivateRefetch =
      !!incoming.gameState &&
      !isLobbyState(incoming.gameState) &&
      incoming.status === "playing";
    return { room: incoming, needsPrivateRefetch };
  }

  if (isLobbyState(incoming.gameState) || isLobbyState(prev.gameState)) {
    return { room: incoming, needsPrivateRefetch: false };
  }

  if (incoming.gameType === "poker" && prev.gameType === "poker") {
    const { state, needsPrivateRefetch } = mergePokerPrivate(
      prev.gameState as PokerState,
      incoming.gameState as PokerState,
      viewerId
    );
    return { room: { ...incoming, gameState: state }, needsPrivateRefetch };
  }

  if (incoming.gameType === "blackjack" && prev.gameType === "blackjack") {
    const { state, needsPrivateRefetch } = mergeBlackjackPrivate(
      prev.gameState as BlackjackState,
      incoming.gameState as BlackjackState,
      viewerId
    );
    return { room: { ...incoming, gameState: state }, needsPrivateRefetch };
  }

  return { room: incoming, needsPrivateRefetch: false };
}

/** Ignora updates obsoletos o duplicados. */
export function shouldApplyRoomUpdate(
  current: Room | null,
  incoming: Room
): boolean {
  if (!current) return true;
  return incoming.updatedAt > current.updatedAt;
}
