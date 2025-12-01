#!/bin/bash

# ════════════════════════════════════════════════════════════
# 🔍 SCRIPT DE VERIFICAÇÃO DE WEBHOOK NO SERVIDOR
# Execute este script NO SERVIDOR via SSH
# ════════════════════════════════════════════════════════════

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║   🔍 VERIFICAÇÃO DE WEBHOOK NO SERVIDOR                   ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# ═══════════════════════════════════════════════════════════
# 1. VERIFICAR SE O BACKEND ESTÁ RODANDO
# ═══════════════════════════════════════════════════════════

echo "1️⃣  VERIFICANDO SE O BACKEND ESTÁ RODANDO"
echo "────────────────────────────────────────────────────────────"
echo ""

if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "backend"; then
        echo "✅ Backend está rodando no PM2"
        pm2 list | grep backend
    else
        echo "❌ Backend NÃO está rodando no PM2"
        echo ""
        echo "💡 Inicie o backend:"
        echo "   cd /var/www/disparador-api-oficial/backend"
        echo "   pm2 start npm --name backend -- start"
    fi
else
    echo "⚠️  PM2 não encontrado"
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo ""

# ═══════════════════════════════════════════════════════════
# 2. VERIFICAR VARIÁVEIS DE WEBHOOK NO .ENV
# ═══════════════════════════════════════════════════════════

echo "2️⃣  VERIFICANDO VARIÁVEIS DE WEBHOOK NO .ENV"
echo "────────────────────────────────────────────────────────────"
echo ""

if [ -f "/var/www/disparador-api-oficial/backend/.env" ]; then
    echo "✅ Arquivo .env encontrado"
    echo ""
    
    if grep -q "WEBHOOK_VERIFY_TOKEN" /var/www/disparador-api-oficial/backend/.env; then
        echo "✅ WEBHOOK_VERIFY_TOKEN encontrado"
        grep "WEBHOOK_VERIFY_TOKEN" /var/www/disparador-api-oficial/backend/.env
    else
        echo "❌ WEBHOOK_VERIFY_TOKEN NÃO encontrado"
    fi
    
    if grep -q "WEBHOOK_BASE_URL" /var/www/disparador-api-oficial/backend/.env; then
        echo "✅ WEBHOOK_BASE_URL encontrado"
        grep "WEBHOOK_BASE_URL" /var/www/disparador-api-oficial/backend/.env
    else
        echo "❌ WEBHOOK_BASE_URL NÃO encontrado"
    fi
    
    if grep -q "WEBHOOK_URL" /var/www/disparador-api-oficial/backend/.env; then
        echo "✅ WEBHOOK_URL encontrado"
        grep "WEBHOOK_URL" /var/www/disparador-api-oficial/backend/.env
    else
        echo "❌ WEBHOOK_URL NÃO encontrado"
    fi
else
    echo "❌ Arquivo .env NÃO encontrado em /var/www/disparador-api-oficial/backend/"
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo ""

# ═══════════════════════════════════════════════════════════
# 3. VERIFICAR PORTA 3001
# ═══════════════════════════════════════════════════════════

echo "3️⃣  VERIFICANDO PORTA 3001"
echo "────────────────────────────────────────────────────────────"
echo ""

if netstat -tulpn 2>/dev/null | grep -q ":3001"; then
    echo "✅ Porta 3001 está aberta e em uso"
    netstat -tulpn | grep ":3001"
else
    echo "❌ Porta 3001 NÃO está em uso"
    echo ""
    echo "💡 Verifique se o backend está rodando"
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo ""

# ═══════════════════════════════════════════════════════════
# 4. VERIFICAR CONFIGURAÇÃO DO NGINX
# ═══════════════════════════════════════════════════════════

echo "4️⃣  VERIFICANDO CONFIGURAÇÃO DO NGINX"
echo "────────────────────────────────────────────────────────────"
echo ""

if [ -f "/etc/nginx/sites-available/default" ]; then
    if grep -q "webhook" /etc/nginx/sites-available/default; then
        echo "✅ Configuração de webhook encontrada no Nginx"
        echo ""
        grep -A 10 "location /api/webhook" /etc/nginx/sites-available/default
    else
        echo "❌ Configuração de webhook NÃO encontrada no Nginx"
        echo ""
        echo "💡 Adicione esta configuração no Nginx:"
        echo ""
        echo "location /api/webhook {"
        echo "    proxy_pass http://localhost:3001/api/webhook;"
        echo "    proxy_http_version 1.1;"
        echo "    proxy_set_header Upgrade \$http_upgrade;"
        echo "    proxy_set_header Connection 'upgrade';"
        echo "    proxy_set_header Host \$host;"
        echo "    proxy_set_header X-Real-IP \$remote_addr;"
        echo "    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;"
        echo "    proxy_set_header X-Forwarded-Proto \$scheme;"
        echo "    proxy_cache_bypass \$http_upgrade;"
        echo "}"
    fi
else
    echo "⚠️  Arquivo de configuração do Nginx não encontrado"
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo ""

# ═══════════════════════════════════════════════════════════
# 5. TESTAR WEBHOOK LOCALMENTE
# ═══════════════════════════════════════════════════════════

echo "5️⃣  TESTANDO WEBHOOK LOCALMENTE"
echo "────────────────────────────────────────────────────────────"
echo ""

echo "🧪 Testando endpoint local..."
echo ""

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/webhook/tenant-4?hub.mode=subscribe&hub.verify_token=teste&hub.challenge=teste123)

if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "403" ]; then
    echo "✅ Backend está respondendo (Status: $RESPONSE)"
    if [ "$RESPONSE" = "403" ]; then
        echo "   ⚠️  Token está errado (403), mas o endpoint está funcionando"
    fi
else
    echo "❌ Backend NÃO está respondendo (Status: $RESPONSE)"
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo ""

# ═══════════════════════════════════════════════════════════
# 6. TESTAR WEBHOOK EXTERNAMENTE
# ═══════════════════════════════════════════════════════════

echo "6️⃣  TESTANDO WEBHOOK EXTERNAMENTE"
echo "────────────────────────────────────────────────────────────"
echo ""

echo "🌐 Testando endpoint externo..."
echo ""

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://api.sistemasnettsistemas.com.br/api/webhook/tenant-4?hub.mode=subscribe&hub.verify_token=teste&hub.challenge=teste123)

if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "403" ]; then
    echo "✅ Servidor está respondendo externamente (Status: $RESPONSE)"
    if [ "$RESPONSE" = "403" ]; then
        echo "   ⚠️  Token está errado (403), mas o endpoint está acessível"
    fi
else
    echo "❌ Servidor NÃO está respondendo externamente (Status: $RESPONSE)"
    echo ""
    echo "💡 Possíveis causas:"
    echo "   - Nginx não está configurado corretamente"
    echo "   - Firewall bloqueando"
    echo "   - SSL não está configurado"
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo ""

# ═══════════════════════════════════════════════════════════
# 7. VERIFICAR LOGS DO BACKEND
# ═══════════════════════════════════════════════════════════

echo "7️⃣  ÚLTIMOS LOGS DO BACKEND"
echo "────────────────────────────────────────────────────────────"
echo ""

if command -v pm2 &> /dev/null; then
    echo "📋 Últimas 20 linhas dos logs:"
    echo ""
    pm2 logs backend --lines 20 --nostream
else
    echo "⚠️  PM2 não encontrado"
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo ""

# ═══════════════════════════════════════════════════════════
# 8. RESUMO E RECOMENDAÇÕES
# ═══════════════════════════════════════════════════════════

echo "8️⃣  RESUMO E RECOMENDAÇÕES"
echo "────────────────────────────────────────────────────────────"
echo ""

echo "📋 CHECKLIST:"
echo ""

# Verificar backend
if pm2 list 2>/dev/null | grep -q "backend.*online"; then
    echo "✅ Backend está rodando"
else
    echo "❌ Backend NÃO está rodando"
    echo "   💡 Execute: cd /var/www/disparador-api-oficial/backend && pm2 start npm --name backend -- start"
fi

# Verificar variáveis
if grep -q "WEBHOOK_VERIFY_TOKEN" /var/www/disparador-api-oficial/backend/.env 2>/dev/null; then
    echo "✅ Variáveis de webhook configuradas"
else
    echo "❌ Variáveis de webhook NÃO configuradas"
    echo "   💡 Adicione no .env:"
    echo "      WEBHOOK_VERIFY_TOKEN=seu_token_secreto"
    echo "      WEBHOOK_BASE_URL=https://api.sistemasnettsistemas.com.br"
    echo "      WEBHOOK_URL=https://api.sistemasnettsistemas.com.br/api/webhook"
fi

# Verificar porta
if netstat -tulpn 2>/dev/null | grep -q ":3001"; then
    echo "✅ Porta 3001 está aberta"
else
    echo "❌ Porta 3001 NÃO está aberta"
fi

# Verificar Nginx
if grep -q "webhook" /etc/nginx/sites-available/default 2>/dev/null; then
    echo "✅ Nginx configurado para webhook"
else
    echo "❌ Nginx NÃO configurado para webhook"
    echo "   💡 Adicione a configuração do webhook no Nginx"
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo ""

echo "✅ VERIFICAÇÃO COMPLETA!"
echo ""
echo "📖 Leia o guia completo: CORRIGIR-WEBHOOK-SERVIDOR-ONLINE.md"
echo ""



