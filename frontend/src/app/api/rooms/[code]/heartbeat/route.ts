import { getPublicRoom, touchPlayerPresence } from "@cg/backend";
import { NextRequest, NextResponse } from "next/server";
import { authenticatedRoomPlayer } from "@/lib/server/room-session";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const player = await authenticatedRoomPlayer(req, code);
    if (!player) {
      return NextResponse.json({ error: "Sesión de sala no válida" }, { status: 401 });
    }
    const result = await touchPlayerPresence(code, player.id);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ room: getPublicRoom(result.room, player.id) });
  } catch (error) {
    console.error("[rooms:heartbeat]", error);
    return NextResponse.json({ error: "No se pudo actualizar la presencia" }, { status: 500 });
  }
}
