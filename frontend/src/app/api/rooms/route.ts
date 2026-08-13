import { createGuestSession, createRoom, getPublicRoom } from "@cg/backend";
import { NextRequest, NextResponse } from "next/server";
import { attachRoomSession } from "@/lib/server/room-session";

export async function POST(req: NextRequest) {
  try {
    const { playerName } = await req.json();
    if (!playerName?.trim()) {
      return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
    }
    const session = createGuestSession();
    const room = await createRoom(
      playerName.trim(),
      session.playerId,
      session.tokenHash
    );
    const response = NextResponse.json({
      room: getPublicRoom(room, session.playerId),
      playerId: session.playerId,
    });
    attachRoomSession(response, room.code, session.token);
    return response;
  } catch (error) {
    console.error("[rooms:create]", error);
    return NextResponse.json({ error: "Error al crear sala" }, { status: 500 });
  }
}
