"use client";

import type { Card } from "@cg/backend/types";
import { SUIT_SYMBOL } from "@/lib/game-logic/deck";
import { isRedSuit } from "@/lib/game-logic/card-utils";
import { CardBackBrandLogo } from "@/components/brand/CardBackBrandLogo";
import {
  cardFaceFillDataUri,
  DEFAULT_CARD_FACE_STYLE,
  getStoredCardFaceStyle,
  type CardFaceStyleId,
} from "@/lib/card-face-style";
import { useSyncExternalStore } from "react";

function subscribeCardFaceStyle(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === "cg-card-face-style") onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("cg-card-face-style-change", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("cg-card-face-style-change", onStoreChange);
  };
}

function readCardFaceStyle(): CardFaceStyleId {
  return typeof window === "undefined" ? DEFAULT_CARD_FACE_STYLE : getStoredCardFaceStyle();
}

export function TableCard({
  card,
  index = 0,
  size = "md",
  animate = true,
  variant = "default",
  motion = "deal",
  className = "",
}: {
  card: Card;
  index?: number;
  size?: "sm" | "md" | "lg";
  animate?: boolean;
  variant?: "default" | "victory" | "dealer";
  motion?: "deal" | "flip" | "draw" | "none";
  className?: string;
}) {
  const isHidden = card.hidden;
  const color = isHidden ? "" : isRedSuit(card.suit) ? "red" : "black";
  const revealColor = isRedSuit(card.suit) ? "red" : "black";
  const isFlipReveal = motion === "flip";
  const faceStyle = useSyncExternalStore(subscribeCardFaceStyle, readCardFaceStyle, () => DEFAULT_CARD_FACE_STYLE);

  const motionClass =
    motion === "flip"
      ? "live-table-card--flip"
      : motion === "draw"
        ? "live-table-card--draw"
        : animate && motion !== "none"
          ? "live-table-card--deal"
          : "";

  return (
    <div
      className={`live-table-card live-table-card--${size} live-table-card--${variant} ${motionClass} ${
        isFlipReveal
          ? `live-table-card--${revealColor}`
          : isHidden
            ? "live-table-card--back"
            : `live-table-card--${color}`
      } ${className}`.trim()}
      style={{
        animationDelay:
          motion === "deal" && animate && index > 0 ? `${index * 0.18}s` : undefined,
        zIndex: index,
      }}
    >
      <div className="live-table-card-inner">
        {isFlipReveal ? (
          <>
            <span className="live-table-card-flip-face live-table-card-flip-face--back">
              <CardBackBrandLogo className="live-table-card-back-logo" />
            </span>
            <span
              className={`live-table-card-flip-face live-table-card-flip-face--front live-table-card-flip-face--${revealColor}`}
            >
              {/* Data URI local; next/image no aporta optimización. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="live-table-card-face-bg"
                src={cardFaceFillDataUri(faceStyle)}
                alt=""
                aria-hidden
                draggable={false}
              />
              <span className="live-table-card-rank">{card.rank}</span>
              <span className="live-table-card-suit">{SUIT_SYMBOL[card.suit]}</span>
              <span className="live-table-card-rank live-table-card-rank--bl">{card.rank}</span>
            </span>
          </>
        ) : (
          <>
            {!isHidden && (
              // Data URI generado localmente; next/image no aporta optimización aquí.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="live-table-card-face-bg"
                src={cardFaceFillDataUri(faceStyle)}
                alt=""
                aria-hidden
                draggable={false}
              />
            )}
            {isHidden ? (
              <CardBackBrandLogo className="live-table-card-back-logo" />
            ) : (
              <>
                <span className="live-table-card-rank">{card.rank}</span>
                <span className="live-table-card-suit">{SUIT_SYMBOL[card.suit]}</span>
                <span className="live-table-card-rank live-table-card-rank--bl">{card.rank}</span>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
