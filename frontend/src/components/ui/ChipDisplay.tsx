"use client";

import { getChipColorForValue, type ChipColor } from "@/lib/game-logic/chips";
import { CasinoChip } from "./CasinoChip";
import "./casino-chip.css";

interface ChipDisplayProps {
  amount: number;
  label?: string;
  variant?: ChipColor;
}

export function ChipDisplay({ amount, label, variant }: ChipDisplayProps) {
  const color = variant ?? getChipColorForValue(amount);

  return (
    <div className="chip-display animate-chip-toss">
      <CasinoChip value={amount} color={color} size="sm" />
      {label && <span className="chip-label">{label}</span>}
    </div>
  );
}
