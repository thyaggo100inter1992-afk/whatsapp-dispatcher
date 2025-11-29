#!/bin/bash

# Script de Migração Automática de Controllers
# ATENÇÃO: Este script faz mudanças automáticas. Sempre revise manualmente!

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🤖 AUTO-MIGRAÇÃO DE CONTROLLERS PARA MULTI-TENANT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

CONTROLLERS_DIR="../src/controllers"
BACKUP_DIR="./controller-backups-$(date +%Y%m%d-%H%M%S)"

# Criar diretório de backup
mkdir -p "$BACKUP_DIR"
echo "📁 Backups serão salvos em: $BACKUP_DIR"
echo ""

# Lista de controllers para migrar (excluindo auth.controller)
CONTROLLERS=(
  "bulk-profile.controller.ts"
  "template.controller.ts"
  "whatsapp-catalog.controller.ts"
  "analytics.controller.ts"
  "proxy.controller.ts"
  "qr-webhook.controller.ts"
  "whatsapp-settings.controller.ts"
  "proxy-manager.controller.ts"
  "qr-campaign.controller.ts"
  "webhook.controller.ts"
  "campaign.controller.ts"
  "restriction-list.controller.ts"
)

total=${#CONTROLLERS[@]}
count=0

for controller in "${CONTROLLERS[@]}"; do
  count=$((count + 1))
  filepath="$CONTROLLERS_DIR/$controller"
  
  if [ ! -f "$filepath" ]; then
    echo "⚠️  [$count/$total] $controller - NÃO ENCONTRADO"
    continue
  fi
  
  echo "🔄 [$count/$total] Migrando: $controller"
  
  # Backup
  cp "$filepath" "$BACKUP_DIR/$controller"
  
  # 1. Mudar import
  sed -i "s/import { query } from '..\/database\/connection';/import { tenantQuery } from '..\/database\/tenant-query';/g" "$filepath"
  sed -i 's/import { query } from "..\/database\/connection";/import { tenantQuery } from "..\/database\/tenant-query";/g' "$filepath"
  
  # 2. Substituir await query( por await tenantQuery(req, 
  # NOTA: Isso é uma substituição simples, pode precisar ajustes manuais
  sed -i 's/await query(/await tenantQuery(req, /g' "$filepath"
  
  echo "   ✅ Import atualizado"
  echo "   ✅ Queries atualizadas (REVISE MANUALMENTE!)"
  echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ MIGRAÇÃO AUTOMÁTICA CONCLUÍDA"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  IMPORTANTE - PRÓXIMOS PASSOS:"
echo ""
echo "1. ✅ Backups salvos em: $BACKUP_DIR"
echo "2. ⚠️  REVISE MANUALMENTE cada controller"
echo "3. ➕ Adicione tenant_id nos INSERTs"
echo "4. 🔄 Converta transações para tenantTransaction"
echo "5. 🧪 Teste com 2 tenants diferentes"
echo ""
echo "📖 Consulte: INSTRUCOES-MIGRACAO-POR-CONTROLLER.md"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"





