-- Adicionar coluna profile_picture_url para armazenar foto de perfil da conta WhatsApp

ALTER TABLE whatsapp_accounts
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

COMMENT ON COLUMN whatsapp_accounts.profile_picture_url IS 'URL da foto de perfil do WhatsApp Business';

