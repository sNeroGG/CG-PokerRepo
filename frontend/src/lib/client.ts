const PLAYER_ID_KEY = "cg-player-id";
const PLAYER_NAME_KEY = "cg-player-name";

export function getPlayerId(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(PLAYER_ID_KEY) ?? "";
}

export function setPlayerId(playerId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PLAYER_ID_KEY, playerId);
}

export function getPlayerName(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(PLAYER_NAME_KEY) ?? "";
}

export function setPlayerName(name: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PLAYER_NAME_KEY, name);
}

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Error de servidor");
  return data as T;
}
