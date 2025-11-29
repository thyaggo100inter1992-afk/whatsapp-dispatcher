-- Adicionar campo app_id à tabela whatsapp_accounts
-- Este campo armazena o Application ID (App ID) necessário para a Resumable Upload API
-- que é usada para fazer upload de mídia para templates do WhatsApp

ALTER TABLE whatsapp_accounts 
ADD COLUMN IF NOT EXISTS app_id VARCHAR(255);

COMMENT ON COLUMN whatsapp_accounts.app_id IS 'Application ID (App ID) usado para Resumable Upload API - necessário para criar templates com mídia';



