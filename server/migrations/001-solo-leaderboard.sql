CREATE TABLE IF NOT EXISTS solo_players (
 id uuid PRIMARY KEY,
 name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 20),
 auth text NOT NULL UNIQUE CHECK (auth ~ '^[0-9a-f]{64}$'),
 wins integer NOT NULL DEFAULT 0 CHECK (wins >= 0),
 at bigint NOT NULL,
 active jsonb,
 last uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS solo_players_name_ci ON solo_players (lower(name));
CREATE INDEX IF NOT EXISTS solo_players_ranking ON solo_players (wins DESC, at ASC, id ASC);
