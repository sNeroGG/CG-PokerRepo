import { voteGame, getPublicRoom } from "@cg/backend";
import type { GameType } from "@cg/backend/types";
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
    const { gameType } = await req.json();
    const result = await voteGame(code, player.id, gameType as GameType);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ room: getPublicRoom(result.room, player.id) });
  } catch {
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
