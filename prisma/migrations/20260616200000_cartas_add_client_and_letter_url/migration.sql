-- Add client_id FK and letter_url to cartas_distribucion
ALTER TABLE cartas_distribucion
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS letter_url TEXT;

CREATE INDEX IF NOT EXISTS idx_cartas_client_id ON cartas_distribucion(client_id);
