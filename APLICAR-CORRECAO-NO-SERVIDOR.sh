#!/bin/bash

# ========================================
# 🔧 APLICAR CORREÇÃO DO TENANT_ID NO SERVIDOR
# ========================================

echo "========================================="
echo "🔧 APLICANDO CORREÇÃO DO TENANT_ID"
echo "========================================="
echo ""

# Backup do arquivo original
echo "📦 Fazendo backup do arquivo original..."
cp /root/whatsapp-dispatcher/backend/src/controllers/webhook.controller.ts /root/whatsapp-dispatcher/backend/src/controllers/webhook.controller.ts.backup

# Aplicar correção usando sed
echo "✏️  Aplicando correção..."

sed -i '70,88s/const body = req.body;/const body = req.body;\n\n      \/\/ Obter tenant_id da rota (se disponível)\n      const tenantId = (req as any).tenantIdFromWebhook || null;/' /root/whatsapp-dispatcher/backend/src/controllers/webhook.controller.ts

sed -i 's/INSERT INTO webhook_logs \n         (request_type, request_method, webhook_object, request_body,/INSERT INTO webhook_logs \n         (tenant_id, request_type, request_method, webhook_object, request_body,/' /root/whatsapp-dispatcher/backend/src/controllers/webhook.controller.ts

sed -i 's/VALUES (\$1, \$2, \$3, \$4, \$5, \$6, \$7)/VALUES ($1, $2, $3, $4, $5, $6, $7, $8)/' /root/whatsapp-dispatcher/backend/src/controllers/webhook.controller.ts

sed -i "s/\['notification',/[tenantId,\n          'notification',/" /root/whatsapp-dispatcher/backend/src/controllers/webhook.controller.ts

echo ""
echo "✅ Correção aplicada!"
echo ""
echo "🔨 Recompilando..."
cd /root/whatsapp-dispatcher/backend
rm -rf dist
npm run build

echo ""
echo "🔄 Reiniciando PM2..."
pm2 restart whatsapp-backend

echo ""
echo "========================================="
echo "✅ CORREÇÃO APLICADA COM SUCESSO!"
echo "========================================="
echo ""
echo "Agora envie uma mensagem de teste e verifique!"







