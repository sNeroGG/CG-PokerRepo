"use client";

import { useGameLandscape } from "@/hooks/useGameLandscape";

/** Shell móvil: aplica layout adaptativo en vertical u horizontal. */
export function GameLandscapeGate({ children }: { children: React.ReactNode }) {
  useGameLandscape();
  return <>{children}</>;
}
