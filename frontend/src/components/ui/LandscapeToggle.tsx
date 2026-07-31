"use client";

import { useLandscapeMode } from "@/hooks/useLandscapeMode";

export function LandscapeToggle() {
  const { enabled, toggle, isMobile } = useLandscapeMode();

  if (!isMobile) return null;

  return (
    <button
      type="button"
      className="landscape-toggle-btn"
      onClick={toggle}
      aria-pressed={enabled}
      title={enabled ? "Vista vertical" : "Vista horizontal"}
    >
      {enabled ? "📱 Vertical" : "🔄 Horizontal"}
    </button>
  );
}
