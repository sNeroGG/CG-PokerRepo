"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, getPlayerName, setPlayerId, setPlayerName } from "@/lib/client";
import type { Room } from "@cg/backend/types";
import { BrandImageSlot } from "@/components/brand/BrandImageSlot";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { BRAND_ASSETS, BRAND_TAGLINE } from "@/lib/brand";
import { BrandName } from "@/components/brand/BrandName";
import "@/components/brand/brand-slots.css";
import { ArrowLeft, DoorOpen, Layers3, Plus, Spade } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState(getPlayerName);
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"menu" | "join">("menu");

  async function handleCreate() {
    if (!name.trim()) { setError("Ingresa tu nombre"); return; }
    setLoading(true);
    setError("");
    try {
      setPlayerName(name.trim());
      const { room, playerId } = await api<{ room: Room; playerId: string }>("/api/rooms", {
        method: "POST",
        body: JSON.stringify({ playerName: name.trim() }),
      });
      setPlayerId(playerId);
      router.push(`/room/${room.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!name.trim() || !joinCode.trim()) {
      setError("Nombre y código requeridos");
      return;
    }
    setLoading(true);
    setError("");
    try {
      setPlayerName(name.trim());
      const { room, playerId } = await api<{ room: Room; playerId: string }>(
        `/api/rooms/${joinCode.trim().toUpperCase()}/join`,
        { method: "POST", body: JSON.stringify({ playerName: name.trim() }) }
      );
      setPlayerId(playerId);
      router.push(`/room/${room.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <BrandImageSlot
        src={BRAND_ASSETS.heroBackground}
        className="!opacity-30"
        placeholderLabel="HERO BG"
      />
      <div className="auth-glow" aria-hidden />

      <div className="auth-panel relative z-10 w-full max-w-md space-y-7">
        {/* Logo & título */}
        <div className="text-center">
          <div className="auth-logo-ring">
            <BrandLogo size="lg" />
          </div>
          <div className="auth-suits mb-4">
            <span className="auth-suit-white">♠</span>
            <span className="auth-suit-gold">♥</span>
            <span className="auth-suit-gold">♦</span>
            <span className="auth-suit-white">♣</span>
          </div>
          <h1 className="auth-title auth-title--brand">
            <BrandName />
          </h1>
          <p className="auth-subtitle">{BRAND_TAGLINE}</p>
        </div>

        <div className="auth-divider">
          <div className="auth-divider-line" />
          <span className="auth-divider-text">
            {mode === "menu" ? "Acceso" : "Unirse"}
          </span>
          <div className="auth-divider-line" />
        </div>

        {/* Nombre */}
        <div className="space-y-2">
          <label className="auth-label" htmlFor="player-name">Tu nombre</label>
          <input
            id="player-name"
            autoComplete="nickname"
            className="auth-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            placeholder="Ej: Juan"
          />
        </div>

        {mode === "menu" ? (
          <div className="space-y-3">
            <button className="auth-btn-primary" disabled={loading} onClick={handleCreate}>
              <Plus size={18} aria-hidden />
              {loading ? "Creando sala..." : "Crear sala"}
            </button>
            <button className="auth-btn-secondary" onClick={() => setMode("join")}>
              <DoorOpen size={18} aria-hidden />
              Unirse con código
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="auth-label" htmlFor="room-code">Código de sala</label>
              <input
                id="room-code"
                autoComplete="off"
                className="auth-input-code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                placeholder="XXXXXX"
              />
            </div>
            <button className="auth-btn-primary" disabled={loading} onClick={handleJoin}>
              {loading ? "Entrando..." : "Entrar a la Sala"}
            </button>
            <button className="auth-btn-secondary" onClick={() => setMode("menu")}>
              <ArrowLeft size={18} aria-hidden />
              Volver al menú
            </button>
          </div>
        )}

        {error && <p className="auth-error">{error}</p>}

        <div className="grid grid-cols-2 gap-3 border-t border-white/5 pt-5">
          <div className="rounded-xl border border-white/5 bg-black p-3 text-center">
            <Layers3 className="mx-auto text-casino-gold" size={24} strokeWidth={1.5} aria-hidden />
            <p className="mt-1 text-xs font-medium text-white">Blackjack</p>
            <p className="text-[10px] text-white/40">1–8 jugadores</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-black p-3 text-center">
            <Spade className="mx-auto text-casino-gold" size={24} strokeWidth={1.5} aria-hidden />
            <p className="mt-1 text-xs font-medium text-white">Texas Hold&apos;em</p>
            <p className="text-[10px] text-white/40">2–8 jugadores</p>
          </div>
        </div>
      </div>
    </main>
  );
}
