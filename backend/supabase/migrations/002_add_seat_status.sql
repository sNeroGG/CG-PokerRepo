-- Estado de asiento: active (en mesa) | waiting (sala de espera)
ALTER TABLE room_players
  ADD COLUMN IF NOT EXISTS seat_status TEXT NOT NULL DEFAULT 'active'
  CHECK (seat_status IN ('active', 'waiting'));
