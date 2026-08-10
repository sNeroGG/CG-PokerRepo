import { deleteStaleRooms } from "@cg/backend";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  try {
    const result = await deleteStaleRooms();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cleanup-rooms]", err);
    return NextResponse.json({ error: "Error al limpiar salas" }, { status: 500 });
  }
}
