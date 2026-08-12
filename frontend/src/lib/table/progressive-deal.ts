import { CARD_DEAL_INTERVAL_MS } from "./deal-sequence";

export type ProgressiveDealView = {
  visibleGlobal: number;
  complete: boolean;
  isDealing: boolean;
};

/** Progreso del deal según reloj de servidor (misma vista en todos los clientes). */
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
  const complete = visibleGlobal >= dealCardCount;

  return {
    visibleGlobal,
    complete,
    isDealing: !complete,
  };
}
