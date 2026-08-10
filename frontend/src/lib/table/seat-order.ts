import type { Player } from "@cg/backend/types";

/** Ordena jugadores activos con el viewer en posición 0 (centro-abajo, POV). */
export function orderPlayersFirstPerson(
  players: Player[],
  viewerId: string
): Player[] {
  const active = players.filter((p) => (p.seatStatus ?? "active") === "active");
  const myIndex = active.findIndex((p) => p.id === viewerId);
  if (myIndex <= 0) return active;
  return [...active.slice(myIndex), ...active.slice(0, myIndex)];
}
