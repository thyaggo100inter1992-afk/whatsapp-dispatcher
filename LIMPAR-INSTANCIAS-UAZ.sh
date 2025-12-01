#!/bin/bash
# Script para limpar TODAS as instâncias da UAZ API e do banco local
# ATEN��ÃO: Isso vai DELETAR TODAS AS CONEXÕES!

echo "🗑️  LIMPANDO TODAS AS INSTÂNCIAS DA UAZ API..."
echo ""

# Token de autenticação do seu tenant
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwibm9tZSI6IlRISUFHTyBHT0RJTkhPIE9MSVZFSVJBIiwiZW1haWwiOiJ0aGlhZ29nb2RpbmhvQGhvdG1haWwuY29tIiwicm9sZSI6ImFkbWluIiwidGVuYW50X2lkIjo0LCJwZXJtaXNzb2VzIjp7InRvZGFzIjp0cnVlLCJmdW5jaW9uYWxpZGFkZXMiOnt9fSwiaWF0IjoxNzMzMDcxMjY4LCJleHAiOjE3MzMxNTc2Njh9.5EXd_39DcP-fYlDc1Sl8ER7WtjZUYQpZ-cTtxRFmXcw"

# 1. Buscar todas as instâncias
echo "📋 Buscando todas as instâncias da UAZ API..."
curl -s -H "Authorization: Bearer $TOKEN" \
  'http://localhost:4000/api/uaz/fetch-instances' | jq .

echo ""
echo "⚠️  ATENÇÃO: Este script vai DELETAR TODAS as instâncias acima!"
echo "❌ Se você NÃO quer fazer isso, pressione CTRL+C AGORA!"
echo ""
read -p "🚨 Tem certeza que deseja continuar? Digite 'SIM' para confirmar: " confirm

if [ "$confirm" != "SIM" ]; then
  echo "❌ Operação cancelada."
  exit 1
fi

echo ""
echo "🗑️  Deletando todas as instâncias..."

# 2. Deletar todas as instâncias do banco (tenant_id = 4)
sudo -u postgres psql -d whatsapp_dispatcher -c "
  DELETE FROM uaz_instances WHERE tenant_id = 4;
"

echo ""
echo "✅ Todas as instâncias foram deletadas!"
echo "💡 Agora você pode criar novas instâncias sem conflitos."

