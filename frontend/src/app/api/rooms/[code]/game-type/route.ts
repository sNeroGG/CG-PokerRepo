import { setGameType, getPublicRoom } from "@cg/backend";
import type { GameType } from "@cg/backend/types";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const { playerId, gameType } = await req.json();
    const result = await setGameType(code, playerId, gameType as GameType);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ room: getPublicRoom(result.room, playerId) });
  } catch {
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
