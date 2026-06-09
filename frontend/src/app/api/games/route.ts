import { listGames } from "@cg/backend";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ games: listGames() });
}
