-- ===================================================================
-- SCRIPT SEGURO: NORMALIZAR CPF/CNPJ COM TRATAMENTO DE DUPLICATAS
-- ===================================================================
-- Este script identifica e resolve duplicatas ANTES de normalizar
-- ===================================================================

BEGIN;

-- ETAPA 1: Identificar duplicatas que surgirão após normalização
-- Incluindo documentos JÁ normalizados no check
CREATE TEMP TABLE todos_documentos_normalizados AS
SELECT 
    id,
    tenant_id,
    LPAD(documento, CASE WHEN LENGTH(documento) <= 11 THEN 11 ELSE 14 END, '0') as documento_normalizado,
    documento as documento_original,
    data_adicao
FROM base_dados_completa;

CREATE TEMP TABLE duplicatas_futuras AS
SELECT 
    documento_normalizado,
    tenant_id,
    COUNT(*) as total,
    ARRAY_AGG(id ORDER BY LENGTH(documento_original) DESC, data_adicao DESC, id DESC) as todos_ids
FROM todos_documentos_normalizados
GROUP BY documento_normalizado, tenant_id
HAVING COUNT(*) > 1;

-- Mostrar quantas duplicatas existem
SELECT 
    'DUPLICATAS ENCONTRADAS' as status,
    COUNT(*) as total_grupos_duplicados,
    SUM(total - 1) as registros_a_remover
FROM duplicatas_futuras;

-- ETAPA 2: Excluir duplicados (mantém o que tem mais dígitos ou o mais recente)
-- Mantém apenas o primeiro ID de cada grupo (que tem prioridade por estar normalizado ou ser mais recente)
DELETE FROM base_dados_completa
WHERE id IN (
    SELECT UNNEST(todos_ids[2:array_length(todos_ids, 1)])
    FROM duplicatas_futuras
);

-- Mostrar quantos registros foram removidos
SELECT 
    '🗑️ DUPLICADOS REMOVIDOS' as status,
    (SELECT SUM(total - 1) FROM duplicatas_futuras) as registros_excluidos;

-- ETAPA 3: Agora normalizar os documentos restantes
UPDATE base_dados_completa
SET documento = LPAD(documento, 11, '0')
WHERE LENGTH(documento) < 11;

UPDATE base_dados_completa
SET documento = LPAD(documento, 14, '0')
WHERE LENGTH(documento) BETWEEN 12 AND 13;

-- ETAPA 4: Verificar resultado final
SELECT 
    '✅ RESULTADO FINAL' as status,
    COUNT(*) as total_registros,
    COUNT(CASE WHEN LENGTH(documento) = 11 THEN 1 END) as cpfs_corretos,
    COUNT(CASE WHEN LENGTH(documento) = 14 THEN 1 END) as cnpjs_corretos,
    COUNT(CASE WHEN LENGTH(documento) < 11 THEN 1 END) as cpfs_incorretos,
    COUNT(CASE WHEN LENGTH(documento) BETWEEN 12 AND 13 THEN 1 END) as cnpjs_incorretos
FROM base_dados_completa;

COMMIT;

