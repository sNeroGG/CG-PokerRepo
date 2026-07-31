"use client";

import { useGameLandscape } from "@/hooks/useGameLandscape";

/** En móvil: bloquea juego en vertical hasta girar el dispositivo. */
export function GameLandscapeGate({ children }: { children: React.ReactNode }) {
  const { isMobile, isPortrait } = useGameLandscape();

  return (
    <>
      {isMobile && isPortrait && (
        <div className="portrait-blocker" role="dialog" aria-label="Gira el dispositivo">
          <div className="portrait-blocker__content">
            <span className="portrait-blocker__icon" aria-hidden>
              📱↻
            </span>
            <p className="portrait-blocker__title">Gira tu teléfono</p>
            <p className="portrait-blocker__hint">El juego solo funciona en horizontal</p>
          </div>
        </div>
      )}
      {children}
    </>
  );
}
