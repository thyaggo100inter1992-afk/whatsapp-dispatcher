#!/bin/bash

# ============================================
# 🔒 BACKUP ANTES DA MIGRAÇÃO MULTI-TENANT
# ============================================

echo "============================================"
echo "🔒 BACKUP ANTES DA MIGRAÇÃO MULTI-TENANT"
echo "============================================"
echo ""

# Ler variáveis do .env
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Valores padrão se não encontrar no .env
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-whatsapp_dispatcher}
DB_USER=${DB_USER:-postgres}

echo "📋 Configurações:"
echo "   Host: $DB_HOST"
echo "   Porta: $DB_PORT"
echo "   Banco: $DB_NAME"
echo "   Usuário: $DB_USER"
echo ""

# Criar pasta de backups se não existir
mkdir -p backups

# Nome do arquivo com timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backups/backup_before_multi_tenant_${TIMESTAMP}.sql"

echo "📦 Criando backup..."
echo "   Arquivo: $BACKUP_FILE"
echo ""

# Executar pg_dump
PGPASSWORD=$DB_PASSWORD pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -F p -f $BACKUP_FILE

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ BACKUP CRIADO COM SUCESSO!"
    echo ""
    echo "📂 Localização: $BACKUP_FILE"
    
    # Mostrar tamanho do arquivo
    SIZE=$(du -h $BACKUP_FILE | cut -f1)
    echo "📊 Tamanho: $SIZE"
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🔒 BACKUP SEGURO CRIADO!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "💡 Para restaurar este backup (se necessário):"
    echo "   psql -h $DB_HOST -U $DB_USER -d $DB_NAME < $BACKUP_FILE"
    echo ""
    echo "🚀 Agora você pode prosseguir com a migração!"
    echo ""
else
    echo ""
    echo "❌ ERRO AO CRIAR BACKUP!"
    echo ""
    echo "Verifique:"
    echo " 1. PostgreSQL está instalado e acessível"
    echo " 2. Credenciais no arquivo .env estão corretas"
    echo " 3. Banco de dados existe"
    echo ""
    echo "⚠️ NÃO PROSSIGA COM A MIGRAÇÃO SEM BACKUP!"
    echo ""
    exit 1
fi





