-- Sesiones invitadas seguras, presencia y escritura atómica por sala.
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1;

ALTER TABLE room_players
  ADD COLUMN IF NOT EXISTS session_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_room_player_session_token
  ON room_players(room_id, session_token_hash)
  WHERE session_token_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION save_room_atomic(
  p_code TEXT,
  p_expected_version BIGINT,
  p_room JSONB,
  p_players JSONB
)
RETURNS TABLE(room_id UUID, room_version BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room_id UUID;
  v_version BIGINT;
  v_player JSONB;
BEGIN
  SELECT id, version
    INTO v_room_id, v_version
    FROM rooms
    WHERE code = upper(p_code)
    FOR UPDATE;

  IF v_room_id IS NULL THEN
    IF p_expected_version IS NOT NULL AND p_expected_version > 0 THEN
      RAISE EXCEPTION 'ROOM_NOT_FOUND';
    END IF;

    INSERT INTO rooms(code, host_id, game_type, status, game_state, version)
    VALUES (
      upper(p_code),
      p_room->>'hostId',
      NULLIF(p_room->>'gameType', ''),
      p_room->>'status',
      p_room->'gameState',
      1
    )
    RETURNING id, version INTO v_room_id, v_version;
  ELSE
    IF p_expected_version IS NULL OR v_version <> p_expected_version THEN
      RAISE EXCEPTION 'ROOM_VERSION_CONFLICT';
    END IF;

    UPDATE rooms
      SET host_id = p_room->>'hostId',
          game_type = NULLIF(p_room->>'gameType', ''),
          status = p_room->>'status',
          game_state = p_room->'gameState',
          version = version + 1,
          updated_at = now()
      WHERE id = v_room_id
      RETURNING version INTO v_version;
  END IF;

  FOR v_player IN SELECT value FROM jsonb_array_elements(p_players)
  LOOP
    INSERT INTO room_players(
      room_id,
      player_id,
      name,
      chips,
      is_host,
      is_connected,
      seat_status,
      game_vote,
      session_token_hash,
      last_seen_at
    )
    VALUES (
      v_room_id,
      v_player->>'id',
      v_player->>'name',
      (v_player->>'chips')::INTEGER,
      COALESCE((v_player->>'isHost')::BOOLEAN, false),
      COALESCE((v_player->>'isConnected')::BOOLEAN, true),
      COALESCE(v_player->>'seatStatus', 'active'),
      NULLIF(v_player->>'gameVote', ''),
      NULLIF(v_player->>'sessionTokenHash', ''),
      COALESCE(to_timestamp((v_player->>'lastSeenAt')::DOUBLE PRECISION / 1000), now())
    )
    ON CONFLICT (room_id, player_id) DO UPDATE SET
      name = EXCLUDED.name,
      chips = EXCLUDED.chips,
      is_host = EXCLUDED.is_host,
      is_connected = EXCLUDED.is_connected,
      seat_status = EXCLUDED.seat_status,
      game_vote = EXCLUDED.game_vote,
      session_token_hash = COALESCE(EXCLUDED.session_token_hash, room_players.session_token_hash),
      last_seen_at = EXCLUDED.last_seen_at;
  END LOOP;

  DELETE FROM room_players existing
    WHERE existing.room_id = v_room_id
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_players) player
        WHERE player->>'id' = existing.player_id
      );

  RETURN QUERY SELECT v_room_id, v_version;
END;
$$;

REVOKE ALL ON FUNCTION save_room_atomic(TEXT, BIGINT, JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION save_room_atomic(TEXT, BIGINT, JSONB, JSONB) TO service_role;
