"use client";

import type { CSSProperties } from "react";
import {
  decomposeIntoChips,
  formatChipCenterLabel,
  getChipColorForValue,
  type ChipColor,
} from "@/lib/game-logic/chips";
import "./casino-chip.css";

export type CasinoChipSize = "xs" | "sm" | "md" | "lg";

export interface CasinoChipProps {
  value: number;
  color?: ChipColor;
  label?: string;
  size?: CasinoChipSize;
  stacked?: boolean;
  stackOffset?: number;
  className?: string;
  style?: CSSProperties;
  animate?: "fly-to-table" | "land" | "add-chip" | "none";
  animationDelay?: number;
}

export function CasinoChip({
  value,
  color,
  label,
  size = "md",
  stacked = false,
  stackOffset = 0,
  className = "",
  style,
  animate = "none",
  animationDelay = 0,
}: CasinoChipProps) {
  const chipColor = color ?? getChipColorForValue(value);
  const displayLabel = label ?? formatChipCenterLabel(value);

  const animClass =
    animate === "fly-to-table"
      ? "casino-chip--fly-to-table"
      : animate === "add-chip"
        ? "casino-chip--add-chip"
        : animate === "land"
          ? "casino-chip--landed"
          : "";

  const mergedStyle: CSSProperties = {
    ...style,
    ...(stacked ? { bottom: stackOffset, zIndex: Math.round(stackOffset) } : {}),
    ...(animationDelay > 0 ? { animationDelay: `${animationDelay}ms` } : {}),
  };

  return (
    <div
      className={`casino-chip casino-chip--${chipColor} casino-chip--${size} ${
        stacked ? "casino-chip--stacked" : ""
      } ${animClass} ${className}`.trim()}
      style={mergedStyle}
      aria-hidden
    >
      <div className="casino-chip__body">
        <span className="casino-chip__inlay">
          <span className="casino-chip__value">{displayLabel}</span>
        </span>
      </div>
    </div>
  );
}

export function CasinoChipStack({
  amount,
  previousAmount = 0,
  size = "sm",
  maxChips = 6,
  className = "",
  animate,
  baseDelay = 0,
}: {
  amount: number;
  previousAmount?: number;
  size?: CasinoChipSize;
  maxChips?: number;
  className?: string;
  animate?: "fly-to-table" | "add-chips" | "land" | "none";
  baseDelay?: number;
}) {
  const stackHeight = 5;
  const prev = Math.min(previousAmount, amount);

  if (animate === "add-chips" && prev > 0 && amount > prev) {
    const previousChips = decomposeIntoChips(prev, maxChips);
    const finalChips = decomposeIntoChips(amount, maxChips);
    const remainingPrevious = new Map<string, number>();
    for (const chip of previousChips) {
      const key = `${chip.color}-${chip.value}`;
      remainingPrevious.set(key, (remainingPrevious.get(key) ?? 0) + 1);
    }
    let addedIndex = 0;

    return (
      <div
        className={`chip-stack chip-stack--${size} chip-stack--exchanging ${className}`.trim()}
        aria-label={`Fichas por un total de ${amount}`}
      >
        {finalChips.map((chip, index) => {
          const denominationKey = `${chip.color}-${chip.value}`;
          const previousCount = remainingPrevious.get(denominationKey) ?? 0;
          const persists = previousCount > 0;
          if (persists) remainingPrevious.set(denominationKey, previousCount - 1);
          const delay = persists ? 0 : baseDelay + addedIndex++ * 90;
          return (
            <CasinoChip
              key={`final-${denominationKey}-${index}`}
              value={chip.value}
              color={chip.color}
              label={chip.label}
              size={size}
              stacked
              stackOffset={index * stackHeight}
              animate={persists ? "land" : "add-chip"}
              animationDelay={delay}
            />
          );
        })}
      </div>
    );
  }

  const chips = decomposeIntoChips(amount, maxChips);

  if (chips.length === 0) return null;

  const flyAnimate = animate === "fly-to-table" ? "fly-to-table" : animate === "land" ? "land" : "none";

  return (
    <div className={`chip-stack chip-stack--${size} ${className}`.trim()}>
      {chips.map((chip, i) => (
        <CasinoChip
          key={`${chip.color}-${chip.value}-${i}`}
          value={chip.value}
          color={chip.color}
          label={chip.label}
          size={size}
          stacked
          stackOffset={i * stackHeight}
          animate={flyAnimate}
          animationDelay={baseDelay + i * 90}
        />
      ))}
    </div>
  );
}
