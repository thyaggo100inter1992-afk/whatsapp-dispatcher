-- ============================================
-- ADICIONAR CAMPOS DE VERIFICAÇÃO WHATSAPP
-- ============================================

-- Adicionar colunas para verificação de WhatsApp
ALTER TABLE novavida_jobs
ADD COLUMN IF NOT EXISTS verify_whatsapp BOOLEAN DEFAULT true;

ALTER TABLE novavida_jobs
ADD COLUMN IF NOT EXISTS whatsapp_delay INTEGER DEFAULT 3;

-- Comentários
COMMENT ON COLUMN novavida_jobs.verify_whatsapp IS 'Se deve verificar WhatsApp dos telefones retornados';
COMMENT ON COLUMN novavida_jobs.whatsapp_delay IS 'Delay em segundos entre verificações de WhatsApp (proteção anti-ban)';







