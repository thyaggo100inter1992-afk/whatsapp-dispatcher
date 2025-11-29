#!/bin/bash
# ============================================
# BLOCO 10: VERIFICAÇÕES FINAIS
# Execute DEPOIS do Bloco 9
# ============================================

echo "==================================="
echo "🔍 VERIFICAÇÕES FINAIS"
echo "==================================="

echo ""
echo "📊 Status dos serviços PM2:"
pm2 list

echo ""
echo "🧪 Testando API local (http://localhost:3001/api/health)..."
curl http://localhost:3001/api/health || echo "⚠️ API local não respondeu"

echo ""
echo ""
echo "🧪 Testando Frontend local (http://localhost:3000)..."
curl http://localhost:3000 -I | head -1 || echo "⚠️ Frontend local não respondeu"

echo ""
echo ""
echo "🌐 Testando API externa (https://api.sistemasnettsistemas.com.br/api/health)..."
curl https://api.sistemasnettsistemas.com.br/api/health || echo "⚠️ API externa não respondeu"

echo ""
echo ""
echo "🌐 Testando Frontend externo (https://sistemasnettsistemas.com.br)..."
curl https://sistemasnettsistemas.com.br -I | head -1 || echo "⚠️ Frontend externo não respondeu"

echo ""
echo ""
echo "==================================="
echo "✅ INSTALAÇÃO CONCLUÍDA!"
echo "==================================="
echo ""
echo "📍 URLs do Sistema:"
echo "   Frontend: https://sistemasnettsistemas.com.br"
echo "   API: https://api.sistemasnettsistemas.com.br/api/health"
echo ""
echo "📋 Comandos úteis:"
echo "   pm2 logs              - Ver logs em tempo real"
echo "   pm2 restart all       - Reiniciar serviços"
echo "   pm2 monit             - Monitorar recursos"
echo "   systemctl status nginx - Status do NGINX"
echo ""
echo "==================================="

