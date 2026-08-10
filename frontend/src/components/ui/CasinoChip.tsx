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
    const baseChips = decomposeIntoChips(prev, maxChips);
    const deltaChips = decomposeIntoChips(amount - prev, Math.max(2, maxChips - baseChips.length));
    const baseOffset = baseChips.length * stackHeight;

    return (
      <div className={`chip-stack chip-stack--${size} ${className}`.trim()}>
        {baseChips.map((chip, i) => (
          <CasinoChip
            key={`base-${chip.color}-${chip.value}-${i}`}
            value={chip.value}
            color={chip.color}
            label={chip.label}
            size={size}
            stacked
            stackOffset={i * stackHeight}
            animate="land"
          />
        ))}
        {deltaChips.map((chip, i) => (
          <CasinoChip
            key={`delta-${chip.color}-${chip.value}-${i}`}
            value={chip.value}
            color={chip.color}
            label={chip.label}
            size={size}
            stacked
            stackOffset={baseOffset + i * stackHeight}
            animate="add-chip"
            animationDelay={baseDelay + i * 90}
          />
        ))}
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
