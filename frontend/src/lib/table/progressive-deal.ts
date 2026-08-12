import { CARD_DEAL_INTERVAL_MS } from "./deal-sequence";

export type ProgressiveDealView = {
  visibleGlobal: number;
  complete: boolean;
  isDealing: boolean;
};

/**
 * Progreso del deal según reloj de servidor.
 * La carta N aparece en (N-1)*INTERVAL; el batch solo termina tras
 * count*INTERVAL para que la última carta (p. ej. hit/double) anime.
 */
export function computeProgressiveDeal(
  dealStartedAt: number | undefined,
  dealCardCount: number | undefined,
  now: number
): ProgressiveDealView {
  if (!dealCardCount || !dealStartedAt) {
    return {
      visibleGlobal: dealCardCount ?? Number.MAX_SAFE_INTEGER,
      complete: true,
      isDealing: false,
    };
  }

  const elapsed = Math.max(0, now - dealStartedAt);
  const visibleGlobal = Math.min(
    dealCardCount,
    Math.floor(elapsed / CARD_DEAL_INTERVAL_MS) + 1
  );
  // Antes: complete cuando visibleGlobal >= count → hit/double (1 carta) sin animación
  const complete = elapsed >= dealCardCount * CARD_DEAL_INTERVAL_MS;

  return {
    visibleGlobal,
    complete,
    isDealing: !complete,
  };
}
