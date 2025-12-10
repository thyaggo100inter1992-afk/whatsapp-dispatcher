-- ========================================
-- SCRIPT DE MIGRAÇÃO: NORMALIZAR CPF/CNPJ
-- ========================================
-- Este script adiciona zeros à esquerda em todos os CPFs/CNPJs
-- que estão com menos de 11 dígitos (CPF) ou 14 dígitos (CNPJ)
--
-- ATENÇÃO: Faça backup antes de executar!
-- ========================================

BEGIN;

-- 1. Mostrar estatísticas ANTES da correção
SELECT 
    '📊 ANTES DA CORREÇÃO' as status,
    COUNT(*) as total_registros,
    COUNT(CASE WHEN LENGTH(documento) < 11 THEN 1 END) as cpfs_incorretos,
    COUNT(CASE WHEN LENGTH(documento) BETWEEN 12 AND 13 THEN 1 END) as cnpjs_incorretos
FROM base_dados_completa;

-- 2. Mostrar exemplos de documentos que serão corrigidos
SELECT 
    '📝 EXEMPLOS DE CPFs QUE SERÃO CORRIGIDOS' as info,
    id,
    documento as documento_atual,
    LPAD(documento, 11, '0') as documento_corrigido,
    LENGTH(documento) as digitos_atuais,
    nome
FROM base_dados_completa
WHERE LENGTH(documento) < 11
LIMIT 10;

SELECT 
    '📝 EXEMPLOS DE CNPJs QUE SERÃO CORRIGIDOS' as info,
    id,
    documento as documento_atual,
    LPAD(documento, 14, '0') as documento_corrigido,
    LENGTH(documento) as digitos_atuais,
    nome
FROM base_dados_completa
WHERE LENGTH(documento) BETWEEN 12 AND 13
LIMIT 10;

-- 3. CORRIGIR CPFs (adicionar zeros até 11 dígitos)
UPDATE base_dados_completa
SET documento = LPAD(documento, 11, '0')
WHERE LENGTH(documento) < 11;

-- 4. CORRIGIR CNPJs (adicionar zeros até 14 dígitos)
UPDATE base_dados_completa
SET documento = LPAD(documento, 14, '0')
WHERE LENGTH(documento) BETWEEN 12 AND 13;

-- 5. Mostrar estatísticas DEPOIS da correção
SELECT 
    '✅ DEPOIS DA CORREÇÃO' as status,
    COUNT(*) as total_registros,
    COUNT(CASE WHEN LENGTH(documento) < 11 THEN 1 END) as cpfs_incorretos,
    COUNT(CASE WHEN LENGTH(documento) BETWEEN 12 AND 13 THEN 1 END) as cnpjs_incorretos,
    COUNT(CASE WHEN LENGTH(documento) = 11 THEN 1 END) as cpfs_corretos,
    COUNT(CASE WHEN LENGTH(documento) = 14 THEN 1 END) as cnpjs_corretos
FROM base_dados_completa;

-- 6. Mostrar exemplos de documentos corrigidos
SELECT 
    '🎉 EXEMPLOS DE DOCUMENTOS CORRIGIDOS' as info,
    id,
    documento,
    LENGTH(documento) as total_digitos,
    nome
FROM base_dados_completa
WHERE LENGTH(documento) IN (11, 14)
ORDER BY id DESC
LIMIT 20;

-- ⚠️ REMOVER ESTE ROLLBACK E USAR COMMIT PARA APLICAR AS MUDANÇAS
ROLLBACK;

-- ✅ DEPOIS DE VERIFICAR OS RESULTADOS ACIMA, COMENTE O ROLLBACK E DESCOMENTE O COMMIT:
-- COMMIT;

