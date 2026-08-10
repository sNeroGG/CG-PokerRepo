"use client";

import { ReactNode } from "react";
import "./immersive-table.css";

/** Ambiente lounge + POV de primera persona alrededor de la mesa. */
export function ImmersiveTableScene({ children }: { children: ReactNode }) {
  return (
    <div className="immersive-table-scene">
      <div className="immersive-lounge-bg" aria-hidden>
        <div className="immersive-lounge-vignette" />
        <div className="immersive-lounge-floor" />
        <div className="immersive-lounge-glow immersive-lounge-glow--green" />
        <div className="immersive-lounge-glow immersive-lounge-glow--blue" />
        <div className="immersive-lounge-stripes" />
      </div>
      <div className="immersive-chair-pov" aria-hidden />
      <div className="immersive-table-stage">{children}</div>
    </div>
  );
}
