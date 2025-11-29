#!/bin/bash
# ============================================
# BLOCO 8: INICIAR SERVIÇOS COM PM2
# Execute DEPOIS do Bloco 7
# ============================================

echo "==================================="
echo "🚀 INICIANDO SERVIÇOS COM PM2..."
echo "==================================="

# Iniciar Backend
echo "Iniciando Backend..."
cd /root/whatsapp-dispatcher/backend
pm2 delete whatsapp-backend 2>/dev/null || true
pm2 start npm --name "whatsapp-backend" -- start

echo ""
echo "Aguardando 5 segundos..."
sleep 5

# Iniciar Frontend
echo "Iniciando Frontend..."
cd /root/whatsapp-dispatcher/frontend
pm2 delete whatsapp-frontend 2>/dev/null || true
pm2 start npm --name "whatsapp-frontend" -- start

echo ""
echo "Aguardando 5 segundos..."
sleep 5

# Salvar configuração do PM2
pm2 save

echo ""
echo "==================================="
echo "📊 STATUS DOS SERVIÇOS:"
echo "==================================="
pm2 list

echo ""
echo "==================================="
echo "⚠️ IMPORTANTE - CONFIGURAR AUTO-START:"
echo "==================================="
echo "Execute o comando que vai aparecer abaixo:"
echo ""

pm2 startup

echo ""
echo "👆 COPIE E EXECUTE O COMANDO ACIMA! 👆"
echo ""
echo "==================================="
echo "✅ BLOCO 8 CONCLUÍDO!"
echo "==================================="

