#!/bin/bash

# ════════════════════════════════════════════════════════════
# 🔍 DIAGNÓSTICO COMPLETO DE WEBHOOK - SERVIDOR ONLINE
# Execute este script NO SERVIDOR via SSH
# ════════════════════════════════════════════════════════════

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║   🔍 DIAGNÓSTICO COMPLETO DE WEBHOOK                      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ═══════════════════════════════════════════════════════════
# TESTE 1: VERIFICAR ESTRUTURA DE PASTAS
# ═══════════════════════════════════════════════════════════

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  VERIFICANDO ESTRUTURA DE PASTAS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ -d "/var/www/disparador-api-oficial" ]; then
    echo -e "${GREEN}✅ Pasta do projeto encontrada${NC}"
    ls -la /var/www/disparador-api-oficial/
else
    echo -e "${RED}❌ Pasta do projeto NÃO encontrada${NC}"
    echo "Procurando em outros locais..."
    find /var/www -name "backend" -type d 2>/dev/null
fi

echo ""

# ═══════════════════════════════════════════════════════════
# TESTE 2: VERIFICAR ARQUIVO .ENV
# ═══════════════════════════════════════════════════════════

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  VERIFICANDO ARQUIVO .ENV"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

ENV_FILE="/var/www/disparador-api-oficial/backend/.env"

if [ -f "$ENV_FILE" ]; then
    echo -e "${GREEN}✅ Arquivo .env encontrado${NC}"
    echo ""
    echo "📋 Variáveis de WEBHOOK:"
    echo "----------------------------------------"
    
    if grep -q "WEBHOOK_VERIFY_TOKEN" "$ENV_FILE"; then
        echo -e "${GREEN}✅ WEBHOOK_VERIFY_TOKEN:${NC}"
        grep "WEBHOOK_VERIFY_TOKEN" "$ENV_FILE" | sed 's/=.*/=***OCULTO***/'
        WEBHOOK_TOKEN=$(grep "WEBHOOK_VERIFY_TOKEN" "$ENV_FILE" | cut -d'=' -f2)
    else
        echo -e "${RED}❌ WEBHOOK_VERIFY_TOKEN não encontrado${NC}"
        WEBHOOK_TOKEN=""
    fi
    
    if grep -q "WEBHOOK_BASE_URL" "$ENV_FILE"; then
        echo -e "${GREEN}✅ WEBHOOK_BASE_URL:${NC}"
        grep "WEBHOOK_BASE_URL" "$ENV_FILE"
    else
        echo -e "${RED}❌ WEBHOOK_BASE_URL não encontrado${NC}"
    fi
    
    if grep -q "WEBHOOK_URL" "$ENV_FILE"; then
        echo -e "${GREEN}✅ WEBHOOK_URL:${NC}"
        grep "WEBHOOK_URL" "$ENV_FILE"
    else
        echo -e "${RED}❌ WEBHOOK_URL não encontrado${NC}"
    fi
    
    echo ""
    echo "📋 Outras variáveis importantes:"
    echo "----------------------------------------"
    grep "^PORT=" "$ENV_FILE" || echo -e "${YELLOW}⚠️  PORT não definido${NC}"
    grep "^NODE_ENV=" "$ENV_FILE" || echo -e "${YELLOW}⚠️  NODE_ENV não definido${NC}"
    
else
    echo -e "${RED}❌ Arquivo .env NÃO encontrado em $ENV_FILE${NC}"
fi

echo ""

# ═══════════════════════════════════════════════════════════
# TESTE 3: VERIFICAR PM2
# ═══════════════════════════════════════════════════════════

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  VERIFICANDO PM2 E BACKEND"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if command -v pm2 &> /dev/null; then
    echo -e "${GREEN}✅ PM2 instalado${NC}"
    echo ""
    pm2 list
    echo ""
    
    if pm2 list | grep -E "backend|whatsapp-backend" | grep -q "online"; then
        echo -e "${GREEN}✅ Backend está ONLINE${NC}"
        
        # Pegar o nome do processo
        BACKEND_NAME=$(pm2 list | grep -E "backend|whatsapp-backend" | grep "online" | awk '{print $2}' | head -1)
        echo "Nome do processo: $BACKEND_NAME"
        
        echo ""
        echo "📊 Informações do processo:"
        pm2 info "$BACKEND_NAME" 2>/dev/null || pm2 info backend 2>/dev/null || pm2 info whatsapp-backend
        
    else
        echo -e "${RED}❌ Backend NÃO está rodando${NC}"
    fi
else
    echo -e "${RED}❌ PM2 não está instalado${NC}"
fi

echo ""

# ═══════════════════════════════════════════════════════════
# TESTE 4: VERIFICAR PORTA 3001
# ═══════════════════════════════════════════════════════════

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4️⃣  VERIFICANDO PORTA 3001"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if netstat -tulpn 2>/dev/null | grep -q ":3001"; then
    echo -e "${GREEN}✅ Porta 3001 está ABERTA e em uso${NC}"
    netstat -tulpn | grep ":3001"
else
    echo -e "${RED}❌ Porta 3001 NÃO está em uso${NC}"
    echo ""
    echo "Verificando outras portas Node.js:"
    netstat -tulpn | grep "node"
fi

echo ""

# ═══════════════════════════════════════════════════════════
# TESTE 5: VERIFICAR NGINX
# ═══════════════════════════════════════════════════════════

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5️⃣  VERIFICANDO CONFIGURAÇÃO DO NGINX"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

NGINX_CONFIG="/etc/nginx/sites-available/default"

if [ -f "$NGINX_CONFIG" ]; then
    echo -e "${GREEN}✅ Arquivo de configuração do Nginx encontrado${NC}"
    echo ""
    
    if grep -q "webhook" "$NGINX_CONFIG"; then
        echo -e "${GREEN}✅ Configuração de webhook encontrada:${NC}"
        echo "----------------------------------------"
        grep -A 12 "location.*webhook" "$NGINX_CONFIG"
    else
        echo -e "${RED}❌ Configuração de webhook NÃO encontrada${NC}"
        echo ""
        echo "Procurando por proxy_pass para porta 3001:"
        grep -n "3001" "$NGINX_CONFIG" || echo "Nenhuma referência à porta 3001"
    fi
    
    echo ""
    echo "📋 Testando configuração do Nginx:"
    nginx -t 2>&1
else
    echo -e "${RED}❌ Arquivo de configuração do Nginx não encontrado${NC}"
fi

echo ""

# ═══════════════════════════════════════════════════════════
# TESTE 6: TESTE LOCAL (localhost)
# ═══════════════════════════════════════════════════════════

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6️⃣  TESTE LOCAL (localhost:3001)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "🧪 Testando endpoint genérico:"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/webhook 2>/dev/null)
echo "Status: $RESPONSE"

if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "400" ]; then
    echo -e "${GREEN}✅ Backend está respondendo localmente${NC}"
else
    echo -e "${RED}❌ Backend NÃO está respondendo (Status: $RESPONSE)${NC}"
fi

echo ""
echo "🧪 Testando endpoint do tenant-4:"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/webhook/tenant-4 2>/dev/null)
echo "Status: $RESPONSE"

if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "400" ]; then
    echo -e "${GREEN}✅ Endpoint tenant-4 está respondendo${NC}"
else
    echo -e "${RED}❌ Endpoint tenant-4 NÃO está respondendo (Status: $RESPONSE)${NC}"
fi

echo ""

if [ ! -z "$WEBHOOK_TOKEN" ]; then
    echo "🧪 Testando verificação do webhook com token:"
    RESPONSE=$(curl -s "http://localhost:3001/api/webhook/tenant-4?hub.mode=subscribe&hub.verify_token=$WEBHOOK_TOKEN&hub.challenge=teste_local_123")
    echo "Resposta: $RESPONSE"
    
    if [ "$RESPONSE" = "teste_local_123" ]; then
        echo -e "${GREEN}✅ WEBHOOK LOCAL FUNCIONANDO PERFEITAMENTE!${NC}"
    else
        echo -e "${RED}❌ Webhook local NÃO retornou o challenge correto${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Token não disponível, pulando teste de verificação${NC}"
fi

echo ""

# ═══════════════════════════════════════════════════════════
# TESTE 7: TESTE EXTERNO (domínio público)
# ═══════════════════════════════════════════════════════════

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "7️⃣  TESTE EXTERNO (domínio público)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "🌐 Testando endpoint público:"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://api.sistemasnettsistemas.com.br/api/webhook/tenant-4 2>/dev/null)
echo "Status: $RESPONSE"

if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "400" ]; then
    echo -e "${GREEN}✅ Endpoint público está acessível${NC}"
else
    echo -e "${RED}❌ Endpoint público NÃO está acessível (Status: $RESPONSE)${NC}"
fi

echo ""

if [ ! -z "$WEBHOOK_TOKEN" ]; then
    echo "🧪 Testando verificação do webhook externo com token:"
    RESPONSE=$(curl -s "https://api.sistemasnettsistemas.com.br/api/webhook/tenant-4?hub.mode=subscribe&hub.verify_token=$WEBHOOK_TOKEN&hub.challenge=teste_externo_456")
    echo "Resposta: $RESPONSE"
    
    if [ "$RESPONSE" = "teste_externo_456" ]; then
        echo -e "${GREEN}✅ WEBHOOK EXTERNO FUNCIONANDO PERFEITAMENTE!${NC}"
    else
        echo -e "${RED}❌ Webhook externo NÃO retornou o challenge correto${NC}"
    fi
fi

echo ""

# ═══════════════════════════════════════════════════════════
# TESTE 8: VERIFICAR LOGS DO BACKEND
# ═══════════════════════════════════════════════════════════

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "8️⃣  LOGS DO BACKEND (últimas 30 linhas)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if command -v pm2 &> /dev/null; then
    BACKEND_NAME=$(pm2 list | grep -E "backend|whatsapp-backend" | grep "online" | awk '{print $2}' | head -1)
    
    if [ ! -z "$BACKEND_NAME" ]; then
        pm2 logs "$BACKEND_NAME" --lines 30 --nostream
    else
        pm2 logs backend --lines 30 --nostream 2>/dev/null || pm2 logs whatsapp-backend --lines 30 --nostream
    fi
else
    echo -e "${YELLOW}⚠️  PM2 não disponível${NC}"
fi

echo ""

# ═══════════════════════════════════════════════════════════
# TESTE 9: VERIFICAR BANCO DE DADOS (webhook_logs)
# ═══════════════════════════════════════════════════════════

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "9️⃣  VERIFICANDO BANCO DE DADOS (webhook_logs)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if command -v psql &> /dev/null; then
    echo "🗄️  Últimos 5 webhooks recebidos:"
    echo ""
    
    PGPASSWORD="Senhaforte123!@#" psql -U whatsapp_user -d whatsapp_dispatcher -c "
    SELECT 
        id,
        request_type,
        request_method,
        verification_success,
        received_at
    FROM webhook_logs
    ORDER BY id DESC
    LIMIT 5;
    " 2>/dev/null || echo -e "${YELLOW}⚠️  Não foi possível conectar ao banco de dados${NC}"
    
    echo ""
    echo "📊 Estatísticas (últimas 24h):"
    echo ""
    
    PGPASSWORD="Senhaforte123!@#" psql -U whatsapp_user -d whatsapp_dispatcher -c "
    SELECT 
        COUNT(*) as total_webhooks,
        COUNT(*) FILTER (WHERE request_type = 'verification') as verificacoes,
        COUNT(*) FILTER (WHERE request_type = 'event') as eventos,
        MAX(received_at) as ultimo_webhook
    FROM webhook_logs
    WHERE received_at > NOW() - INTERVAL '24 hours';
    " 2>/dev/null
else
    echo -e "${YELLOW}⚠️  PostgreSQL (psql) não está disponível${NC}"
fi

echo ""

# ═══════════════════════════════════════════════════════════
# TESTE 10: VERIFICAR FIREWALL
# ═══════════════════════════════════════════════════════════

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔟 VERIFICANDO FIREWALL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if command -v ufw &> /dev/null; then
    ufw status
else
    echo -e "${YELLOW}⚠️  UFW não está instalado${NC}"
fi

echo ""

# ═══════════════════════════════════════════════════════════
# RESUMO FINAL
# ═══════════════════════════════════════════════════════════

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 RESUMO DO DIAGNÓSTICO"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "✓ = OK | ✗ = PROBLEMA | ? = VERIFICAR"
echo ""

# Verificações
[ -d "/var/www/disparador-api-oficial" ] && echo -e "${GREEN}✓${NC} Pasta do projeto" || echo -e "${RED}✗${NC} Pasta do projeto"

[ -f "$ENV_FILE" ] && echo -e "${GREEN}✓${NC} Arquivo .env" || echo -e "${RED}✗${NC} Arquivo .env"

[ ! -z "$WEBHOOK_TOKEN" ] && echo -e "${GREEN}✓${NC} WEBHOOK_VERIFY_TOKEN configurado" || echo -e "${RED}✗${NC} WEBHOOK_VERIFY_TOKEN não configurado"

pm2 list 2>/dev/null | grep -E "backend|whatsapp-backend" | grep -q "online" && echo -e "${GREEN}✓${NC} Backend rodando no PM2" || echo -e "${RED}✗${NC} Backend não está rodando"

netstat -tulpn 2>/dev/null | grep -q ":3001" && echo -e "${GREEN}✓${NC} Porta 3001 aberta" || echo -e "${RED}✗${NC} Porta 3001 não está aberta"

grep -q "webhook" "$NGINX_CONFIG" 2>/dev/null && echo -e "${GREEN}✓${NC} Nginx configurado para webhook" || echo -e "${YELLOW}?${NC} Nginx pode não estar configurado"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "🎯 PRÓXIMOS PASSOS:"
echo ""

if [ -z "$WEBHOOK_TOKEN" ]; then
    echo -e "${RED}1. ADICIONAR WEBHOOK_VERIFY_TOKEN no .env${NC}"
    echo "   nano /var/www/disparador-api-oficial/backend/.env"
    echo ""
fi

if ! pm2 list 2>/dev/null | grep -E "backend|whatsapp-backend" | grep -q "online"; then
    echo -e "${RED}2. INICIAR O BACKEND${NC}"
    echo "   pm2 restart backend"
    echo ""
fi

if ! grep -q "webhook" "$NGINX_CONFIG" 2>/dev/null; then
    echo -e "${YELLOW}3. VERIFICAR CONFIGURAÇÃO DO NGINX${NC}"
    echo "   cat /etc/nginx/sites-available/default | grep webhook"
    echo ""
fi

echo "4. APÓS CORRIGIR, TESTAR NO FACEBOOK DEVELOPERS"
echo "   https://developers.facebook.com/apps"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ DIAGNÓSTICO COMPLETO!"
echo ""










