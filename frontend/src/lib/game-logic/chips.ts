/**
 * Colores de ficha según convención de casino (EE.UU. / Las Vegas):
 * - Rojo  → $5   (apuesta baja en mesa)
 * - Azul  → $10  (apuesta media)
 * - Verde → $25  (apuesta alta)
 *
 * En esta mesa escalamos desde $100 y añadimos fichas altas para evitar pilas saturadas.
 */
export type ChipColor = "red" | "blue" | "green" | "black" | "gold";

export interface ChipDenomination {
  value: number;
  color: ChipColor;
  /** Texto en el círculo blanco central */
  label: string;
}

export const CHIP_DENOMINATIONS: readonly ChipDenomination[] = [
  { value: 10000, color: "gold", label: "10K" },
  { value: 5000, color: "black", label: "5K" },
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
  if (value >= 10000) return "gold";
  if (value >= 5000) return "black";
  if (value >= 1000) return "green";
  if (value >= 500) return "blue";
  return "red";
}

export interface PlacedChip {
  value: number;
  color: ChipColor;
  label: string;
}

function placedChip(value: number, color = getChipColorForValue(value)): PlacedChip {
  const denomination = CHIP_DENOMINATIONS.find((candidate) => candidate.value === value);
  return {
    value,
    color: denomination?.color ?? color,
    label: denomination?.label ?? formatChipCenterLabel(value),
  };
}

/**
 * Descompone un monto usando cambio real: al alcanzar una denominación superior,
 * las fichas inferiores se sustituyen (400 = 4×100, 500 = 1×500).
 */
export function decomposeIntoChips(amount: number, maxChips = 8): PlacedChip[] {
  const normalizedAmount = Math.max(0, Math.round(amount));
  const visualLimit = Math.max(1, Math.floor(maxChips));
  if (normalizedAmount <= 0) return [];

  let remaining = normalizedAmount;
  const complete: PlacedChip[] = [];

  for (const denom of CHIP_DENOMINATIONS) {
    while (remaining >= denom.value) {
      complete.push(placedChip(denom.value, denom.color));
      remaining -= denom.value;
    }
  }

  if (remaining > 0) complete.push(placedChip(remaining, "red"));
  if (complete.length <= visualLimit) return complete;

  const visible = complete.slice(0, visualLimit - 1);
  const compactedValue = complete
    .slice(visualLimit - 1)
    .reduce((sum, chip) => sum + chip.value, 0);
  return [...visible, placedChip(compactedValue)];
}

/** Agrupa fichas iguales para pilas en UI de apuesta */
export function groupChipStacks(amount: number): Array<{ denom: ChipDenomination; count: number }> {
  const groups: Array<{ denom: ChipDenomination; count: number }> = [];
  let remaining = Math.max(0, Math.round(amount));

  for (const denom of CHIP_DENOMINATIONS) {
    const count = Math.floor(remaining / denom.value);
    if (count > 0) {
      groups.push({ denom, count });
      remaining -= count * denom.value;
    }
  }

  if (remaining > 0) {
    groups.push({
      denom: {
        value: remaining,
        color: getChipColorForValue(remaining),
        label: formatChipCenterLabel(remaining),
      },
      count: 1,
    });
  }

  return groups;
}
