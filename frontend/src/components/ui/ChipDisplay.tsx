"use client";

import { getChipColorForValue } from "@/lib/game-logic/chips";
import { CasinoChip } from "./CasinoChip";
import "./casino-chip.css";

interface ChipDisplayProps {
  amount: number;
  label?: string;
  variant?: "red" | "blue" | "green" | "gold";
}

export function ChipDisplay({ amount, label, variant }: ChipDisplayProps) {
  const color =
    variant && variant !== "gold"
      ? variant
      : getChipColorForValue(amount);

  return (
    <div className="chip-display animate-chip-toss">
      <CasinoChip value={amount} color={color} size="sm" />
      {label && <span className="chip-label">{label}</span>}
    </div>
  );
}
