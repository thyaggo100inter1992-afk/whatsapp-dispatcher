-- Migração: campos avançados na tabela email_marketing_campaigns
-- Múltiplos remetentes, múltiplos assuntos, agendamento, horário de trabalho, pausa automática

ALTER TABLE email_marketing_campaigns
  ADD COLUMN IF NOT EXISTS from_senders   JSONB,          -- [{"from_name":"...","from_email":"..."}]
  ADD COLUMN IF NOT EXISTS subjects       JSONB,          -- ["Assunto A","Assunto B"]
  ADD COLUMN IF NOT EXISTS delay_seconds_min  INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS delay_seconds_max  INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS scheduled_at   TIMESTAMP,
  ADD COLUMN IF NOT EXISTS work_start_time VARCHAR(5) DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS work_end_time   VARCHAR(5) DEFAULT '20:00',
  ADD COLUMN IF NOT EXISTS pause_after     INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pause_duration_minutes INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS pause_started_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS sent_in_session INTEGER DEFAULT 0;

-- Adicionar status 'scheduled' se ainda não existir
ALTER TABLE email_marketing_campaigns
  DROP CONSTRAINT IF EXISTS email_marketing_campaigns_status_check;

ALTER TABLE email_marketing_campaigns
  ADD CONSTRAINT email_marketing_campaigns_status_check
  CHECK (status IN ('draft','scheduled','sending','paused','completed','failed','cancelled'));
