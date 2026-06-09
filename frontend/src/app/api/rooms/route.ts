import { createRoom, getPublicRoom } from "@cg/backend";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { playerName, playerId } = await req.json();
    if (!playerName?.trim() || !playerId) {
      return NextResponse.json({ error: "Nombre y ID requeridos" }, { status: 400 });
    }
    const room = await createRoom(playerName.trim(), playerId);
    return NextResponse.json({ room: getPublicRoom(room, playerId) });
  } catch {
    return NextResponse.json({ error: "Error al crear sala" }, { status: 500 });
  }
}
