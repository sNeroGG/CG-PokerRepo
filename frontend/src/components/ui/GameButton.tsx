"use client";

import {
  Check,
  Coins,
  CopyPlus,
  Equal,
  Flag,
  Hand,
  Plus,
  Split,
  TrendingUp,
  XCircle,
  Zap,
  type LucideIcon,
} from "lucide-react";

type GameButtonVariant = "hit" | "stand" | "double" | "bet" | "fold" | "check" | "call" | "raise" | "allin" | "split" | "surrender" | "primary" | "secondary";

const VARIANT_STYLES: Record<GameButtonVariant, string> = {
  hit: "game-btn game-btn-hit",
  stand: "game-btn game-btn-stand",
  double: "game-btn game-btn-double",
  bet: "game-btn game-btn-bet",
  fold: "game-btn game-btn-fold",
  check: "game-btn game-btn-check",
  call: "game-btn game-btn-call",
  raise: "game-btn game-btn-raise",
  allin: "game-btn game-btn-allin",
  split: "game-btn game-btn-raise",
  surrender: "game-btn game-btn-fold",
  primary: "game-btn game-btn-primary",
  secondary: "game-btn game-btn-secondary",
};

const VARIANT_ICONS: Partial<Record<GameButtonVariant, LucideIcon>> = {
  hit: Plus,
  stand: Hand,
  double: CopyPlus,
  bet: Coins,
  fold: XCircle,
  check: Check,
  call: Equal,
  raise: TrendingUp,
  allin: Zap,
  split: Split,
  surrender: Flag,
};

interface GameButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant: GameButtonVariant;
  label: string;
  sublabel?: string;
}

export function GameButton({
  variant,
  label,
  sublabel,
  className = "",
  disabled,
  ...props
}: GameButtonProps) {
  const Icon = VARIANT_ICONS[variant];
  return (
    <button
      className={`${VARIANT_STYLES[variant]} ${disabled ? "game-btn-disabled" : ""} ${className}`}
      disabled={disabled}
      {...props}
    >
      {Icon && <Icon className="game-btn-icon" size={18} strokeWidth={1.8} aria-hidden />}
      <span className="game-btn-text">
        <span className="game-btn-label">{label}</span>
        {sublabel && <span className="game-btn-sub">{sublabel}</span>}
      </span>
    </button>
  );
}

interface ActionBarProps {
  children: React.ReactNode;
  title?: string;
}

export function ActionBar({ children, title }: ActionBarProps) {
  return (
    <div className="action-bar">
      {title && <p className="action-bar-title">{title}</p>}
      <div className="action-bar-buttons">{children}</div>
    </div>
  );
}

export function StatusBanner({
  message,
  type = "info",
}: {
  message: string;
  type?: "info" | "success" | "error" | "turn";
}) {
  return (
    <div
      className={`status-banner status-${type}`}
      role={type === "error" ? "alert" : "status"}
      aria-live={type === "turn" || type === "error" ? "polite" : undefined}
    >
      {type === "turn" && <span className="status-dot" />}
      {message}
    </div>
  );
}
