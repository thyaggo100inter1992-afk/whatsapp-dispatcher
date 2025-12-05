-- Adicionar campo de ordenação para contas WhatsApp
-- Isso permite que o usuário defina manualmente a ordem de exibição das contas

-- Adicionar campo display_order
ALTER TABLE whatsapp_accounts 
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Atualizar contas existentes para terem uma ordem baseada no ID (mais antigas primeiro)
UPDATE whatsapp_accounts 
SET display_order = id * 10 
WHERE display_order = 0;

-- Criar índice para melhorar performance de ordenação
CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_display_order 
ON whatsapp_accounts(tenant_id, display_order);

-- Comentário
COMMENT ON COLUMN whatsapp_accounts.display_order IS 'Ordem de exibição da conta nos menus (menor = primeiro)';

