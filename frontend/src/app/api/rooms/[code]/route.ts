import { getPublicRoom, getRoom } from "@cg/backend";
import { NextRequest, NextResponse } from "next/server";
import { authenticatedRoomPlayer } from "@/lib/server/room-session";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const room = await getRoom(code);
    if (!room) {
      return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });
    }
    const player = await authenticatedRoomPlayer(req, code);
    if (!player) {
      return NextResponse.json({ error: "Sesión de sala no válida" }, { status: 401 });
    }
    return NextResponse.json({
      room: getPublicRoom(room, player.id),
      playerId: player.id,
    });
  } catch {
    return NextResponse.json({ error: "Error al obtener sala" }, { status: 500 });
  }
}
