-- Voto de juego en lobby
ALTER TABLE room_players
  ADD COLUMN IF NOT EXISTS game_vote TEXT
  CHECK (game_vote IS NULL OR game_vote IN ('blackjack', 'poker'));
