"use client";

import { useCallback, useRef, useState } from "react";

type LiveActionButtonProps = {
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  "aria-label"?: string;
};

/** Botón con feedback táctil claro al pulsar (móvil y desktop). */
export function LiveActionButton({
  className = "",
  disabled,
  onClick,
  children,
  ...rest
}: LiveActionButtonProps) {
  const [pressed, setPressed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback(() => {
    setPressed(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setPressed(false), 220);
  }, []);

  return (
    <button
      type="button"
      className={`live-btn ${pressed ? "live-btn--pressed" : ""} ${className}`.trim()}
      disabled={disabled}
      onPointerDown={(e) => {
        if (disabled) return;
        if (e.button !== 0 && e.pointerType === "mouse") return;
        flash();
      }}
      onClick={() => {
        if (disabled) return;
        flash();
        onClick?.();
      }}
      {...rest}
    >
      <span className="live-btn__label">{children}</span>
    </button>
  );
}
