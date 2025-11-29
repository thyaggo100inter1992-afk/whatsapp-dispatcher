-- Adicionar campos para integração com Facebook Business
ALTER TABLE whatsapp_accounts 
ADD COLUMN IF NOT EXISTS facebook_access_token TEXT,
ADD COLUMN IF NOT EXISTS facebook_ad_account_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS facebook_business_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMP;

-- Comentários nas colunas
COMMENT ON COLUMN whatsapp_accounts.facebook_access_token IS 'Token criptografado do Facebook para integração financeira';
COMMENT ON COLUMN whatsapp_accounts.facebook_ad_account_id IS 'ID da conta de anúncios do Facebook (act_XXXXX)';
COMMENT ON COLUMN whatsapp_accounts.facebook_business_id IS 'ID do Facebook Business Manager';
COMMENT ON COLUMN whatsapp_accounts.token_expires_at IS 'Data de expiração do token do Facebook (NULL se for System User Token)';


