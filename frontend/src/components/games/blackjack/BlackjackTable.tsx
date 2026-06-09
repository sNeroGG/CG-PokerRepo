"use client";

import type { Room } from "@cg/backend/types";
import { LiveCasinoBlackjackUI } from "./live-casino/LiveCasinoBlackjackUI";

export function BlackjackTable({
  room,
  playerId,
  onUpdate,
}: {
  room: Room;
  playerId: string;
  onUpdate: (room: Room) => void;
}) {
  return <LiveCasinoBlackjackUI room={room} playerId={playerId} onUpdate={onUpdate} />;
}
