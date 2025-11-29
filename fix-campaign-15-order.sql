-- Script para corrigir a ordem dos templates da campanha 15
-- Problema: Templates estavam agrupados por instância
-- Solução: Reordenar para alternar instâncias primeiro, depois templates

-- 1. Criar uma tabela temporária com a nova ordem
WITH ranked_templates AS (
  SELECT 
    ct.id,
    ct.campaign_id,
    ct.instance_id,
    ct.qr_template_id,
    ct.is_active,
    t.name as template_name,
    i.name as instance_name,
    i.phone_number,
    -- Nova lógica de ordenação: agrupa por template_id primeiro, depois por instance_id
    -- Isso faz com que para cada template, todas as instâncias sejam usadas em sequência
    ROW_NUMBER() OVER (
      ORDER BY ct.qr_template_id, ct.instance_id
    ) - 1 as new_order_index
  FROM qr_campaign_templates ct
  LEFT JOIN qr_templates t ON ct.qr_template_id = t.id
  LEFT JOIN uaz_instances i ON ct.instance_id = i.id
  WHERE ct.campaign_id = 15
)
-- 2. Atualizar os order_index com a nova ordem
UPDATE qr_campaign_templates ct
SET order_index = rt.new_order_index
FROM ranked_templates rt
WHERE ct.id = rt.id;

-- 3. Verificar a nova ordem (primeiros 20 registros)
SELECT 
  ct.order_index,
  i.phone_number as instance_phone,
  i.name as instance_name,
  t.name as template_name,
  ct.is_active
FROM qr_campaign_templates ct
LEFT JOIN qr_templates t ON ct.qr_template_id = t.id
LEFT JOIN uaz_instances i ON ct.instance_id = i.id
WHERE ct.campaign_id = 15
ORDER BY ct.order_index
LIMIT 20;

-- 4. Verificar distribuição por instância
SELECT 
  i.phone_number as instance,
  i.name as nome,
  COUNT(*) as total_combinacoes,
  MIN(ct.order_index) as primeiro_index,
  MAX(ct.order_index) as ultimo_index
FROM qr_campaign_templates ct
LEFT JOIN uaz_instances i ON ct.instance_id = i.id
WHERE ct.campaign_id = 15
GROUP BY i.phone_number, i.name
ORDER BY i.phone_number;

