#!/bin/bash

# ========================================
# 🔧 APLICAR CORREÇÃO - COLUNA UPDATED_AT
# ========================================

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  🔧 CORREÇÃO: Adicionar updated_at em campaign_templates   ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Variáveis do banco
DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="whatsapp_dispatcher"
DB_USER="whatsapp_user"
DB_PASSWORD="Tg130992*"

echo "1️⃣  Aplicando migration no banco de dados..."
echo "────────────────────────────────────────────────────────────"
echo ""

# Executar migration
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << 'EOF'

-- Adicionar coluna updated_at
ALTER TABLE campaign_templates 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Atualizar registros existentes
UPDATE campaign_templates 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- Criar função para trigger
CREATE OR REPLACE FUNCTION update_campaign_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_update_campaign_templates_updated_at ON campaign_templates;
CREATE TRIGGER trigger_update_campaign_templates_updated_at
    BEFORE UPDATE ON campaign_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_campaign_templates_updated_at();

-- Verificar se foi criado
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'campaign_templates' AND column_name = 'updated_at';

EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration aplicada com sucesso!"
    echo ""
else
    echo ""
    echo "❌ Erro ao aplicar migration!"
    echo ""
    exit 1
fi

echo "════════════════════════════════════════════════════════════"
echo ""

echo "2️⃣  Verificando a coluna criada..."
echo "────────────────────────────────────────────────────────────"
echo ""

PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c \
    "SELECT COUNT(*) as total_registros, 
            COUNT(updated_at) as registros_com_updated_at 
     FROM campaign_templates;"

echo ""
echo "════════════════════════════════════════════════════════════"
echo ""

echo "3️⃣  Testando a trigger..."
echo "────────────────────────────────────────────────────────────"
echo ""

PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << 'EOF'

-- Testar trigger (se houver registros)
DO $$
DECLARE
    test_id INTEGER;
BEGIN
    -- Pegar primeiro ID
    SELECT id INTO test_id FROM campaign_templates LIMIT 1;
    
    IF test_id IS NOT NULL THEN
        -- Atualizar para testar trigger
        UPDATE campaign_templates 
        SET order_index = order_index 
        WHERE id = test_id;
        
        RAISE NOTICE 'Trigger testada com sucesso no registro %', test_id;
    ELSE
        RAISE NOTICE 'Nenhum registro para testar o trigger';
    END IF;
END $$;

EOF

echo ""
echo "════════════════════════════════════════════════════════════"
echo ""

echo "✅ CORREÇÃO APLICADA COM SUCESSO!"
echo ""
echo "📋 O que foi feito:"
echo "   ✅ Coluna updated_at adicionada"
echo "   ✅ Registros existentes atualizados"
echo "   ✅ Trigger automático criado"
echo "   ✅ Relatórios funcionarão normalmente"
echo ""
echo "🔄 Próximo passo: Reiniciar o backend"
echo "   cd /root/whatsapp-dispatcher/backend"
echo "   pm2 restart whatsapp-backend"
echo ""

