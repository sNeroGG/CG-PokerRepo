import { CARD_DEAL_INTERVAL_MS } from "./deal-sequence";

export type ProgressiveDealView = {
  visibleGlobal: number;
  complete: boolean;
  isDealing: boolean;
};

export function dealBatchDurationMs(dealCardCount: number): number {
  return dealCardCount * CARD_DEAL_INTERVAL_MS;
}

/**
 * Decide el ancla de animación al recibir un batch.
 * - Si el deal ya terminó en el reloj del servidor → snap (sin re-animar).
 * - Si no → arranca en local `now` para que hit/double se vean aunque el RTT
 *   haya comido el tiempo del servidor (caso típico al pulsar Pedir).
 */
export function resolvePresentationStart(
  dealStartedAt: number,
  dealCardCount: number,
  now: number
): number {
  const serverElapsed = Math.max(0, now - dealStartedAt);
  const totalMs = dealBatchDurationMs(dealCardCount);
  if (serverElapsed >= totalMs) {
    return dealStartedAt;
  }
  return now;
}

/**
 * Progreso del deal según ancla de presentación.
 * La carta N aparece en (N-1)*INTERVAL; el batch termina tras count*INTERVAL
 * para que la última carta (hit/double) tenga ventana de animación CSS.
 */
export function computeProgressiveDeal(
  presentationStartedAt: number | undefined,
  dealCardCount: number | undefined,
  now: number
): ProgressiveDealView {
  if (!dealCardCount || !presentationStartedAt) {
    return {
      visibleGlobal: dealCardCount ?? Number.MAX_SAFE_INTEGER,
      complete: true,
      isDealing: false,
    };
  }

  const elapsed = Math.max(0, now - presentationStartedAt);
  const visibleGlobal = Math.min(
    dealCardCount,
    Math.floor(elapsed / CARD_DEAL_INTERVAL_MS) + 1
  );
  const complete = elapsed >= dealBatchDurationMs(dealCardCount);

  return {
    visibleGlobal,
    complete,
    isDealing: !complete,
  };
}
