/**
 * Colores de ficha según convención de casino (EE.UU. / Las Vegas):
 * - Rojo  → $5   (apuesta baja en mesa)
 * - Azul  → $10  (apuesta media)
 * - Verde → $25  (apuesta alta)
 *
 * En esta mesa escalamos: $100 / $500 / $1000 manteniendo la misma jerarquía de color.
 */
export type ChipColor = "red" | "blue" | "green";

export interface ChipDenomination {
  value: number;
  color: ChipColor;
  /** Texto en el círculo blanco central */
  label: string;
}

export const CHIP_DENOMINATIONS: readonly ChipDenomination[] = [
  { value: 1000, color: "green", label: "1K" },
  { value: 500, color: "blue", label: "500" },
  { value: 100, color: "red", label: "100" },
] as const;

export const CHIP_UNIT = 100;

export function formatChipCenterLabel(value: number): string {
  if (value >= 1000 && value % 1000 === 0) return `${value / 1000}K`;
  if (value >= 1000) return String(value);
  return String(value);
}

export function getChipColorForValue(value: number): ChipColor {
  if (value >= 1000) return "green";
  if (value >= 500) return "blue";
  return "red";
}

export interface PlacedChip {
  value: number;
  color: ChipColor;
  label: string;
}

/** Descompone un monto en fichas visuales (greedy, mayor denominación primero). */
export function decomposeIntoChips(amount: number, maxChips = 8): PlacedChip[] {
  if (amount <= 0) return [];

  let remaining = amount;
  const result: PlacedChip[] = [];

  for (const denom of CHIP_DENOMINATIONS) {
    while (remaining >= denom.value && result.length < maxChips) {
      result.push({
        value: denom.value,
        color: denom.color,
        label: denom.label,
      });
      remaining -= denom.value;
    }
  }

  if (remaining > 0 && result.length < maxChips) {
    result.push({
      value: remaining,
      color: "red",
      label: formatChipCenterLabel(remaining),
    });
  }

  return result;
}

/** Agrupa fichas iguales para pilas en UI de apuesta */
export function groupChipStacks(amount: number): Array<{ denom: ChipDenomination; count: number }> {
  const groups: Array<{ denom: ChipDenomination; count: number }> = [];

  for (const denom of CHIP_DENOMINATIONS) {
    const count = Math.floor(amount / denom.value);
    if (count > 0) {
      groups.push({ denom, count: Math.min(count, 6) });
    }
  }

  return groups;
}
