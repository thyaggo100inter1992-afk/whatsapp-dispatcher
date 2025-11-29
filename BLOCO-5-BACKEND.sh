#!/bin/bash
# ============================================
# BLOCO 5: CONFIGURAR BACKEND
# Execute DEPOIS do Bloco 4
# ============================================

echo "==================================="
echo "⚙️ CONFIGURANDO BACKEND..."
echo "==================================="

cd /root/whatsapp-dispatcher/backend

# Criar arquivo .env
cat > .env << 'EOF'
PORT=3001
NODE_ENV=production
DB_HOST=localhost
DB_PORT=5432
DB_NAME=whatsapp_dispatcher
DB_USER=whatsapp_user
DB_PASSWORD=Senhaforte123!@#
JWT_SECRET=chave-super-secreta-aleatoria-minimo-32-caracteres-mudar-em-producao
FRONTEND_URL=https://sistemasnettsistemas.com.br
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
EOF

echo "✅ Arquivo .env criado"
echo ""

# Instalar dependências
echo "📦 Instalando dependências do backend (pode demorar ~3 min)..."
npm install

echo ""
echo "🔨 Compilando backend..."
npm run build

echo ""
echo "==================================="
echo "✅ BLOCO 5 CONCLUÍDO!"
echo "==================================="

