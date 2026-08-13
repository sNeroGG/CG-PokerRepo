import { getRoom, playerForGuestToken } from "@cg/backend";
import type { Player } from "@cg/backend/types";
import type { NextRequest, NextResponse } from "next/server";

const COOKIE_PREFIX = "cg_room_";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function roomSessionCookieName(code: string): string {
  return `${COOKIE_PREFIX}${code.trim().toUpperCase()}`;
}

export function readRoomSessionToken(req: NextRequest, code: string): string | undefined {
  return req.cookies.get(roomSessionCookieName(code))?.value;
}

export function attachRoomSession(
  response: NextResponse,
  code: string,
  token: string
): void {
  response.cookies.set(roomSessionCookieName(code), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });
}

export async function authenticatedRoomPlayer(
  req: NextRequest,
  code: string
): Promise<Player | null> {
  const room = await getRoom(code);
  if (!room) return null;
  return playerForGuestToken(room, readRoomSessionToken(req, code));
}
