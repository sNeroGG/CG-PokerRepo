import { createGuestSession, joinRoom, getPublicRoom } from "@cg/backend";
import { NextRequest, NextResponse } from "next/server";
import {
  attachRoomSession,
  authenticatedRoomPlayer,
  readRoomSessionToken,
} from "@/lib/server/room-session";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const { playerName } = await req.json();
    if (!playerName?.trim()) {
      return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
    }
    const existing = await authenticatedRoomPlayer(req, code);
    const issued = existing ? null : createGuestSession();
    const playerId = existing?.id ?? issued!.playerId;
    const result = await joinRoom(
      code,
      playerName.trim(),
      playerId,
      issued?.tokenHash
    );
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const response = NextResponse.json({
      room: getPublicRoom(result.room, playerId),
      playerId,
    });
    const token = issued?.token ?? readRoomSessionToken(req, code);
    if (token) attachRoomSession(response, code, token);
    return response;
  } catch (error) {
    console.error("[rooms:join]", error);
    return NextResponse.json({ error: "Error al unirse" }, { status: 500 });
  }
}
