-- Adicionar campo de ordenação para instâncias QR Connect
-- Isso permite que o usuário defina manualmente a ordem de exibição das instâncias

-- Adicionar campo display_order
ALTER TABLE uaz_instances 
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Atualizar instâncias existentes para terem uma ordem baseada no ID (mais antigas primeiro)
UPDATE uaz_instances 
SET display_order = id * 10 
WHERE display_order = 0;

-- Criar índice para melhorar performance de ordenação
CREATE INDEX IF NOT EXISTS idx_uaz_instances_display_order 
ON uaz_instances(tenant_id, display_order);

-- Comentário
COMMENT ON COLUMN uaz_instances.display_order IS 'Ordem de exibição da instância nos menus (menor = primeiro)';

