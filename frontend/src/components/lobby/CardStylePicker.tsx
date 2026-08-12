"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

type MenuCoords = { top: number; left: number; width: number };

export function CardStylePicker({ className = "" }: { className?: string }) {
  const { style, setStyle } = useCardFaceStyle();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const menuWidth = Math.min(240, window.innerWidth - 16);
    const gap = 8;
    const maxMenuHeight = Math.min(window.innerHeight * 0.7, 320);
    const menuHeight = Math.min(
      menuRef.current?.offsetHeight ?? 168,
      maxMenuHeight
    );

    let left = rect.right - menuWidth;
    left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));

    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const openUp = spaceBelow < menuHeight && spaceAbove > spaceBelow;

    let top = openUp ? rect.top - gap - menuHeight : rect.bottom + gap;
    top = Math.max(8, Math.min(top, window.innerHeight - menuHeight - 8));

    setCoords({ top, left, width: menuWidth });
  };

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updatePosition();
    // Segunda pasada cuando el menú ya midió su altura real
    const raf = requestAnimationFrame(updatePosition);

    const onReposition = () => updatePosition();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    // pointerdown en siguiente tick: evita cerrar el mismo tap que abre
    const timer = window.setTimeout(() => {
      document.addEventListener("pointerdown", onPointer);
    }, 0);
    document.addEventListener("keydown", onKey);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(id: CardFaceStyleId) {
    setStyle(id);
    setOpen(false);
  }

  const menu =
    open &&
    coords &&
    mounted &&
    createPortal(
      <div
        ref={menuRef}
        className="card-style-picker__menu card-style-picker__menu--portal"
        id={menuId}
        role="listbox"
        aria-label="Estilo de cartas"
        style={{
          top: coords.top,
          left: coords.left,
          width: coords.width,
        }}
      >
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
      </div>,
      document.body
    );

  return (
    <div className={`card-style-picker ${className}`.trim()} ref={rootRef}>
      <button
        ref={triggerRef}
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
      {menu}
    </div>
  );
}
