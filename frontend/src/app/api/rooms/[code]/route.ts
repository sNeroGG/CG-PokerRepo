import { getPublicRoom } from "@cg/backend";
import { getRoom } from "@cg/backend";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const playerId = req.nextUrl.searchParams.get("playerId") ?? undefined;
    const room = await getRoom(code);
    if (!room) {
      return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });
    }
    return NextResponse.json({ room: getPublicRoom(room, playerId) });
  } catch {
    return NextResponse.json({ error: "Error al obtener sala" }, { status: 500 });
  }
}
