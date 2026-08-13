"use client";

import { ArrowLeft, Check, Copy } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { BrandName } from "@/components/brand/BrandName";
import { CardStylePicker } from "@/components/lobby/CardStylePicker";

export function GameHeader({
  roomCode,
  copied,
  onCopy,
  onHome,
}: {
  roomCode: string;
  copied: boolean;
  onCopy: () => void;
  onHome: () => void;
}) {
  return (
    <header className="brand-header-bar">
      <div className="brand-header-bar__left">
        <BrandLogo size="md" />
        <div>
          <p className="brand-header-bar__title">
            <BrandName variant="header" />
          </p>
          <p className="brand-header-bar__code">Sala {roomCode}</p>
        </div>
      </div>
      <div className="brand-header-bar__actions">
        <CardStylePicker />
        <button type="button" className="brand-header-btn" onClick={onCopy}>
          {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
          {copied ? "Copiado" : roomCode}
        </button>
        <button type="button" className="brand-header-btn" onClick={onHome}>
          <ArrowLeft size={15} aria-hidden />
          Inicio
        </button>
      </div>
    </header>
  );
}
