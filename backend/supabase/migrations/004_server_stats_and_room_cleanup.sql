-- Estadísticas globales del servidor y índice para limpieza de salas inactivas

CREATE TABLE IF NOT EXISTS server_stats (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  total_hands_played BIGINT NOT NULL DEFAULT 0,
  player_wins BIGINT NOT NULL DEFAULT 0,
  player_losses BIGINT NOT NULL DEFAULT 0,
  pushes BIGINT NOT NULL DEFAULT 0,
  total_wagered BIGINT NOT NULL DEFAULT 0,
  total_paid_out BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO server_stats (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_rooms_updated_at ON rooms(updated_at);

ALTER TABLE server_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "server_stats_read" ON server_stats FOR SELECT USING (true);
