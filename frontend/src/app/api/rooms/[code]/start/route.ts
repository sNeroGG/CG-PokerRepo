import { startGame, getPublicRoom } from "@cg/backend";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const { playerId } = await req.json();
    const result = await startGame(code, playerId);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ room: getPublicRoom(result.room, playerId) });
  } catch {
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
