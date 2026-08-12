"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  CARD_FACE_STYLES,
  type CardFaceStyleId,
} from "@/lib/card-face-style";
import { useCardFaceStyle } from "@/hooks/useCardFaceStyle";
import "./card-style-picker.css";

function BrushIcon() {
  return (
    <svg className="card-style-picker__icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15.5 3.5l5 5-9.2 9.2a3.2 3.2 0 01-1.5.85l-3.6.7a.8.8 0 01-.93-.93l.7-3.6c.12-.55.4-1.05.85-1.5L15.5 3.5z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M14 5l5 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M4.2 19.2c1.6.2 3-.8 3.4-2.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CardStylePicker({ className = "" }: { className?: string }) {
  const { style, setStyle } = useCardFaceStyle();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(id: CardFaceStyleId) {
    setStyle(id);
    setOpen(false);
  }

  return (
    <div className={`card-style-picker ${className}`.trim()} ref={rootRef}>
      <button
        type="button"
        className="card-style-picker__trigger"
        aria-label="Estilo de cartas"
        aria-expanded={open}
        aria-controls={menuId}
        title="Estilo de cartas"
        onClick={() => setOpen((v) => !v)}
      >
        <BrushIcon />
      </button>

      {open && (
        <div className="card-style-picker__menu" id={menuId} role="listbox" aria-label="Estilo de cartas">
          <p className="card-style-picker__title">Estilo de cartas</p>
          {CARD_FACE_STYLES.map((opt) => {
            const active = style === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={active}
                className={`card-style-picker__option ${active ? "card-style-picker__option--active" : ""}`}
                onClick={() => pick(opt.id)}
              >
                <span
                  className="card-style-picker__swatch"
                  style={{ background: opt.swatch, borderColor: opt.border }}
                />
                <span className="card-style-picker__option-text">
                  <strong>{opt.label}</strong>
                  <span>{opt.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
