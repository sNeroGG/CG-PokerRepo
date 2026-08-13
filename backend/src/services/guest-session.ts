import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { Player, Room } from "../types";

export interface GuestSession {
  playerId: string;
  token: string;
  tokenHash: string;
}

export function hashGuestToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createGuestSession(): GuestSession {
  const token = randomBytes(32).toString("base64url");
  return {
    playerId: randomUUID(),
    token,
    tokenHash: hashGuestToken(token),
  };
}

function hashesMatch(left: string, right: string): boolean {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function playerForGuestToken(room: Room, token: string | undefined): Player | null {
  if (!token) return null;
  const candidate = hashGuestToken(token);
  return (
    room.players.find(
      (player) =>
        typeof player.sessionTokenHash === "string" &&
        hashesMatch(player.sessionTokenHash, candidate)
    ) ?? null
  );
}
