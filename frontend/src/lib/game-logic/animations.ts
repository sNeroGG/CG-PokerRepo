export const CARD_SIZES = {
  sm: { w: 50, h: 72, overlap: 14 },
  md: { w: 68, h: 96, overlap: 18 },
  lg: { w: 84, h: 120, overlap: 22 },
} as const;

export type CardSize = keyof typeof CARD_SIZES;

/** Delay escalonado al repartir desde el crupier */
export function dealDelay(index: number, baseMs = 120): number {
  return index * baseMs;
}

export function staggerDelay(index: number, group = 0, baseMs = 80): number {
  return group * 200 + index * baseMs;
}
