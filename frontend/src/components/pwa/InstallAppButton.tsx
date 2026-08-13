"use client";

import { useEffect, useState } from "react";
import { Download, Share2, X } from "lucide-react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

function isAppleMobile() {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function InstallAppButton() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [appleMobile, setAppleMobile] = useState(false);
  const [showAppleHelp, setShowAppleHelp] = useState(false);

  useEffect(() => {
    setAppleMobile(isAppleMobile());

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
      setShowAppleHelp(false);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || (!promptEvent && !appleMobile)) return null;

  const install = async () => {
    if (promptEvent) {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setPromptEvent(null);
      return;
    }
    setShowAppleHelp((visible) => !visible);
  };

  return (
    <div className="border-t border-white/5 pt-4" data-testid="install-app">
      <button
        type="button"
        className="auth-btn-secondary !py-2.5 !text-sm"
        aria-expanded={appleMobile ? showAppleHelp : undefined}
        onClick={install}
      >
        {appleMobile ? (
          <Share2 size={17} strokeWidth={1.7} aria-hidden />
        ) : (
          <Download size={17} strokeWidth={1.7} aria-hidden />
        )}
        {appleMobile ? "Añadir a pantalla de inicio" : "Instalar aplicación"}
      </button>

      {showAppleHelp && (
        <div
          className="relative mt-3 rounded-xl border border-casino-gold/20 bg-black/60 px-4 py-3 pr-9 text-left text-xs leading-relaxed text-white/70"
          role="status"
        >
          En Safari toca <strong className="text-white">Compartir</strong> y
          luego <strong className="text-white">Añadir a inicio</strong>.
          <button
            type="button"
            className="absolute right-2 top-2 rounded-md p-1 text-white/50 hover:text-white"
            aria-label="Cerrar instrucciones"
            onClick={() => setShowAppleHelp(false)}
          >
            <X size={15} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
