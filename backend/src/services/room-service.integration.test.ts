import assert from "node:assert/strict";
import test from "node:test";
import { createGuestSession } from "./guest-session";
import {
  applyGameAction,
  createRoom,
  getPublicRoom,
  joinRoom,
  setGameType,
  setPlayerReady,
  startGame,
} from "./room-service";
import type { PokerState } from "../types";

test("ocho invitados pueden preparar e iniciar una mesa sin perder mutaciones", async () => {
  const identities = Array.from({ length: 8 }, createGuestSession);
  const room = await createRoom("Jugador 1", identities[0].playerId, identities[0].tokenHash);

  const joins = await Promise.all(
    identities.slice(1).map((identity, index) =>
      joinRoom(room.code, `Jugador ${index + 2}`, identity.playerId, identity.tokenHash)
    )
  );
  assert.equal(joins.filter((result) => "error" in result).length, 0);

  const ninth = createGuestSession();
  const overflow = await joinRoom(room.code, "Jugador 9", ninth.playerId, ninth.tokenHash);
  assert.ok("error" in overflow);
  assert.match(overflow.error, /Sala llena/);

  const selected = await setGameType(room.code, identities[0].playerId, "poker");
  assert.ok(!("error" in selected));
  await Promise.all(
    identities.map((identity) => setPlayerReady(room.code, identity.playerId, true))
  );

  const started = await startGame(room.code, identities[0].playerId);
  assert.ok(!("error" in started));
  if ("error" in started) return;
  assert.equal(started.room.players.length, 8);
  assert.equal(started.room.status, "playing");

  const hand = await applyGameAction(room.code, identities[0].playerId, { type: "startHand" });
  assert.ok(!("error" in hand));
  if ("error" in hand) return;
  const state = hand.room.gameState as PokerState;
  assert.equal(state.players.length, 8);
  assert.equal(state.players.flatMap((player) => player.holeCards).length, 16);
});

test("la sala pública elimina hashes y cartas privadas de rivales", async () => {
  const host = createGuestSession();
  const guest = createGuestSession();
  const room = await createRoom("Host", host.playerId, host.tokenHash);
  await joinRoom(room.code, "Invitado", guest.playerId, guest.tokenHash);
  await setGameType(room.code, host.playerId, "poker");
  await setPlayerReady(room.code, host.playerId, true);
  await setPlayerReady(room.code, guest.playerId, true);
  await startGame(room.code, host.playerId);
  const hand = await applyGameAction(room.code, host.playerId, { type: "startHand" });
  assert.ok(!("error" in hand));
  if ("error" in hand) return;

  const publicRoom = getPublicRoom(hand.room, host.playerId);
  assert.equal(publicRoom.players.some((player) => player.sessionTokenHash), false);
  const state = publicRoom.gameState as PokerState;
  const rival = state.players.find((player) => player.playerId === guest.playerId)!;
  assert.equal(rival.holeCards.every((card) => card.hidden), true);
});
