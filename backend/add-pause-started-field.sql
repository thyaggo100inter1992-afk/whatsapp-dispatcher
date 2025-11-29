-- Adicionar campo para armazenar quando a pausa programada iniciou
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS pause_started_at TIMESTAMP;

-- Comentário explicativo
COMMENT ON COLUMN campaigns.pause_started_at IS 'Timestamp de quando a pausa programada atual iniciou. NULL = não está em pausa.';


