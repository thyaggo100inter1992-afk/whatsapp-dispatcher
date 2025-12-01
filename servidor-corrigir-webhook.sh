#!/bin/bash

# ════════════════════════════════════════════════════════════
# 🔧 SCRIPT DE CORREÇÃO DE WEBHOOK NO SERVIDOR
# Execute este script NO SERVIDOR via SSH
# ════════════════════════════════════════════════════════════

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║   🔧 CORREÇÃO DE WEBHOOK NO SERVIDOR                      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Solicitar confirmação
read -p "Este script vai modificar configurações do servidor. Continuar? (s/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "❌ Operação cancelada"
    exit 1
fi

echo ""

# ═══════════════════════════════════════════════════════════
# 1. ADICIONAR VARIÁVEIS NO .ENV
# ═══════════════════════════════════════════════════════════

echo "1️⃣  ADICIONANDO VARIÁVEIS NO .ENV"
echo "────────────────────────────────────────────────────────────"
echo ""

ENV_FILE="/var/www/disparador-api-oficial/backend/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Arquivo .env não encontrado em $ENV_FILE"
    exit 1
fi

# Solicitar token
echo "Digite o token de verificação configurado no Facebook Developers:"
read -p "Token: " WEBHOOK_TOKEN

if [ -z "$WEBHOOK_TOKEN" ]; then
    echo "❌ Token não pode estar vazio"
    exit 1
fi

# Verificar se já existe
if grep -q "WEBHOOK_VERIFY_TOKEN" "$ENV_FILE"; then
    echo "⚠️  Variável WEBHOOK_VERIFY_TOKEN já existe"
    read -p "Deseja substituir? (s/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        # Remover linhas antigas
        sed -i '/WEBHOOK_VERIFY_TOKEN/d' "$ENV_FILE"
        sed -i '/WEBHOOK_BASE_URL/d' "$ENV_FILE"
        sed -i '/WEBHOOK_URL/d' "$ENV_FILE"
    else
        echo "❌ Operação cancelada"
        exit 1
    fi
fi

# Adicionar variáveis
echo "" >> "$ENV_FILE"
echo "# Webhook do WhatsApp" >> "$ENV_FILE"
echo "WEBHOOK_VERIFY_TOKEN=$WEBHOOK_TOKEN" >> "$ENV_FILE"
echo "WEBHOOK_BASE_URL=https://api.sistemasnettsistemas.com.br" >> "$ENV_FILE"
echo "WEBHOOK_URL=https://api.sistemasnettsistemas.com.br/api/webhook" >> "$ENV_FILE"

echo "✅ Variáveis adicionadas ao .env"
echo ""

echo "════════════════════════════════════════════════════════════"
echo ""

# ═══════════════════════════════════════════════════════════
# 2. REINICIAR BACKEND
# ═══════════════════════════════════════════════════════════

echo "2️⃣  REINICIANDO BACKEND"
echo "────────────────────────────────────────────────────────────"
echo ""

if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "backend"; then
        pm2 restart backend
        echo "✅ Backend reiniciado"
    else
        echo "⚠️  Backend não está rodando no PM2"
        echo "🚀 Iniciando backend..."
        cd /var/www/disparador-api-oficial/backend
        pm2 start npm --name backend -- start
        pm2 save
        echo "✅ Backend iniciado"
    fi
else
    echo "❌ PM2 não encontrado"
    exit 1
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo ""

# ═══════════════════════════════════════════════════════════
# 3. VERIFICAR/CONFIGURAR NGINX
# ═══════════════════════════════════════════════════════════

echo "3️⃣  VERIFICANDO CONFIGURAÇÃO DO NGINX"
echo "────────────────────────────────────────────────────────────"
echo ""

NGINX_CONFIG="/etc/nginx/sites-available/default"

if [ ! -f "$NGINX_CONFIG" ]; then
    echo "❌ Arquivo de configuração do Nginx não encontrado"
    exit 1
fi

if grep -q "location /api/webhook" "$NGINX_CONFIG"; then
    echo "✅ Configuração de webhook já existe no Nginx"
else
    echo "⚠️  Configuração de webhook NÃO encontrada no Nginx"
    read -p "Deseja adicionar? (s/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        # Fazer backup
        cp "$NGINX_CONFIG" "$NGINX_CONFIG.backup.$(date +%Y%m%d_%H%M%S)"
        
        # Adicionar configuração (antes do último })
        sed -i '/^}$/i \
    location /api/webhook {\
        proxy_pass http://localhost:3001/api/webhook;\
        proxy_http_version 1.1;\
        proxy_set_header Upgrade $http_upgrade;\
        proxy_set_header Connection '"'"'upgrade'"'"';\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
        proxy_set_header X-Forwarded-Proto $scheme;\
        proxy_cache_bypass $http_upgrade;\
    }\
' "$NGINX_CONFIG"
        
        # Testar configuração
        if nginx -t; then
            echo "✅ Configuração do Nginx válida"
            systemctl restart nginx
            echo "✅ Nginx reiniciado"
        else
            echo "❌ Erro na configuração do Nginx"
            echo "🔄 Restaurando backup..."
            mv "$NGINX_CONFIG.backup.$(date +%Y%m%d_%H%M%S)" "$NGINX_CONFIG"
            exit 1
        fi
    fi
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo ""

# ═══════════════════════════════════════════════════════════
# 4. TESTAR WEBHOOK
# ═══════════════════════════════════════════════════════════

echo "4️⃣  TESTANDO WEBHOOK"
echo "────────────────────────────────────────────────────────────"
echo ""

echo "🧪 Aguardando 5 segundos para o backend inicializar..."
sleep 5

echo ""
echo "🧪 Testando webhook localmente..."
RESPONSE=$(curl -s "http://localhost:3001/api/webhook/tenant-4?hub.mode=subscribe&hub.verify_token=$WEBHOOK_TOKEN&hub.challenge=teste123")

if [ "$RESPONSE" = "teste123" ]; then
    echo "✅ Webhook local funcionando! Resposta: $RESPONSE"
else
    echo "❌ Webhook local NÃO funcionou. Resposta: $RESPONSE"
fi

echo ""
echo "🌐 Testando webhook externamente..."
RESPONSE=$(curl -s "https://api.sistemasnettsistemas.com.br/api/webhook/tenant-4?hub.mode=subscribe&hub.verify_token=$WEBHOOK_TOKEN&hub.challenge=teste456")

if [ "$RESPONSE" = "teste456" ]; then
    echo "✅ Webhook externo funcionando! Resposta: $RESPONSE"
else
    echo "❌ Webhook externo NÃO funcionou. Resposta: $RESPONSE"
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo ""

# ═══════════════════════════════════════════════════════════
# 5. RESUMO
# ═══════════════════════════════════════════════════════════

echo "5️⃣  RESUMO"
echo "────────────────────────────────────────────────────────────"
echo ""

echo "✅ CORREÇÕES APLICADAS:"
echo ""
echo "1. ✅ Variáveis adicionadas no .env"
echo "2. ✅ Backend reiniciado"
echo "3. ✅ Nginx configurado (se necessário)"
echo "4. ✅ Testes executados"
echo ""

echo "📋 PRÓXIMOS PASSOS:"
echo ""
echo "1. Acesse o Facebook Developers:"
echo "   https://developers.facebook.com/apps"
echo ""
echo "2. Vá em: WhatsApp → Configuration → Webhooks"
echo ""
echo "3. Clique em 'Edit' e depois em 'Verify and Save'"
echo ""
echo "4. O webhook deve ser verificado com sucesso!"
echo ""
echo "5. Marque o campo 'messages' e clique em 'Subscribe'"
echo ""

echo "════════════════════════════════════════════════════════════"
echo ""

echo "🎉 CORREÇÃO COMPLETA!"
echo ""
echo "📋 Token configurado: $WEBHOOK_TOKEN"
echo "🔗 URL do webhook: https://api.sistemasnettsistemas.com.br/api/webhook/tenant-4"
echo ""
echo "💡 Use o mesmo token no Facebook Developers!"
echo ""



