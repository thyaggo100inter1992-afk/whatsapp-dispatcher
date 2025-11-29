#!/bin/bash
# ============================================
# BLOCO 6: CONFIGURAR FRONTEND
# Execute DEPOIS do Bloco 5
# ============================================

echo "==================================="
echo "🎨 CONFIGURANDO FRONTEND..."
echo "==================================="

cd /root/whatsapp-dispatcher/frontend

# Criar arquivo .env.local
cat > .env.local << 'EOF'
NEXT_PUBLIC_API_URL=https://api.sistemasnettsistemas.com.br/api
NEXT_PUBLIC_SOCKET_URL=https://api.sistemasnettsistemas.com.br
NEXT_PUBLIC_APP_NAME="Disparador NettSistemas"
NEXT_PUBLIC_DISABLE_FRONTEND_LOGS=true
NEXT_PUBLIC_ENABLE_LANDING_PAGE=true
NEXT_PUBLIC_ENABLE_PUBLIC_SIGNUP=false
EOF

echo "✅ Arquivo .env.local criado"
echo ""

# Instalar dependências
echo "📦 Instalando dependências do frontend (pode demorar ~5 min)..."
npm install

echo ""
echo "🔨 Compilando frontend (pode demorar ~3 min)..."
npm run build

echo ""
echo "==================================="
echo "✅ BLOCO 6 CONCLUÍDO!"
echo "==================================="

