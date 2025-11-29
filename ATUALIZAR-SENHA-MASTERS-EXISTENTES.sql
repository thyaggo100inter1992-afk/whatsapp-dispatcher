-- ═══════════════════════════════════════════════════════════════
-- 🔐 ATUALIZAR SENHA DE TODOS OS USUÁRIOS MASTER EXISTENTES
-- ═══════════════════════════════════════════════════════════════
-- 
-- ATENÇÃO: Este script atualiza a senha de TODOS os usuários master
-- para a nova senha padrão: master123@nettsistemas
--
-- Execute este comando uma única vez no PostgreSQL
-- ═══════════════════════════════════════════════════════════════

-- Nova senha: master123@nettsistemas
-- Hash bcrypt (10 rounds): $2a$10$YourHashHere

-- IMPORTANTE: O hash abaixo é um exemplo. 
-- Para gerar o hash correto, use o Node.js:
-- 
-- const bcrypt = require('bcryptjs');
-- const hash = await bcrypt.hash('master123@nettsistemas', 10);
-- console.log(hash);

-- Depois de gerar o hash, substitua no comando abaixo e execute:

-- Descomentar e executar após gerar o hash correto:
/*
UPDATE tenant_users 
SET 
  senha_hash = '$2a$10$SEU_HASH_AQUI',
  updated_at = NOW()
WHERE role = 'super_admin'
AND email LIKE '%@NETTSISTEMAS.COM.BR';
*/

-- Verificar quantos usuários serão afetados ANTES de executar:
SELECT 
  id,
  tenant_id,
  email,
  nome,
  ativo,
  created_at
FROM tenant_users
WHERE role = 'super_admin'
AND email LIKE '%@NETTSISTEMAS.COM.BR'
ORDER BY tenant_id;

-- Após executar o UPDATE, verificar se funcionou:
/*
SELECT 
  COUNT(*) as total_masters_atualizados
FROM tenant_users
WHERE role = 'super_admin'
AND email LIKE '%@NETTSISTEMAS.COM.BR';
*/


