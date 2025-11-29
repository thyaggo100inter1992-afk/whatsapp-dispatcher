-- Definir a primeira credencial Asaas ativa como padrão
-- Execute este script se você tiver cadastrado uma credencial mas ela não for padrão

-- 1. Desmarcar todas como padrão
UPDATE asaas_credentials SET is_default = false;

-- 2. Definir a primeira ativa como padrão
UPDATE asaas_credentials 
SET is_default = true 
WHERE id = (
  SELECT id 
  FROM asaas_credentials 
  WHERE is_active = true 
  ORDER BY created_at ASC 
  LIMIT 1
);

-- 3. Verificar resultado
SELECT 
  id, 
  name, 
  environment,
  is_default,
  is_active,
  created_at
FROM asaas_credentials
ORDER BY is_default DESC, created_at ASC;





