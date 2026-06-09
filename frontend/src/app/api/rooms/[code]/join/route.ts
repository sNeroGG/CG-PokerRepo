import { joinRoom, getPublicRoom } from "@cg/backend";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const { playerName, playerId } = await req.json();
    if (!playerName?.trim() || !playerId) {
      return NextResponse.json({ error: "Nombre y ID requeridos" }, { status: 400 });
    }
    const result = await joinRoom(code, playerName.trim(), playerId);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ room: getPublicRoom(result.room, playerId) });
  } catch {
    return NextResponse.json({ error: "Error al unirse" }, { status: 500 });
  }
}
