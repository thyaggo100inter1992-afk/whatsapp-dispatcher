#!/bin/bash
echo "=========================================="
echo "🚀 ATUALIZANDO SISTEMA COMPLETO"
echo "Data: $(date)"
echo "=========================================="
echo ""

# Passo 1: Git Pull
echo "📥 1. Fazendo git pull..."
cd /root/whatsapp-dispatcher
git pull origin main
if [ $? -eq 0 ]; then
    echo "✅ Git pull concluído!"
else
    echo "❌ Erro no git pull!"
    exit 1
fi
echo ""

# Passo 2: Backend - Remover dist e recompilar
echo "🔧 2. Preparando backend..."
cd /root/whatsapp-dispatcher/backend
echo "   → Removendo pasta dist..."
rm -rf dist
echo "   → Instalando dependências..."
npm install
echo "   → Compilando TypeScript..."
npm run build
if [ $? -eq 0 ]; then
    echo "✅ Backend recompilado!"
else
    echo "❌ Erro ao compilar backend!"
    exit 1
fi
echo ""

# Passo 3: Frontend - Build de produção
echo "🎨 3. Preparando frontend..."
cd /root/whatsapp-dispatcher/frontend
echo "   → Instalando dependências..."
npm install
echo "   → Gerando build de produção..."
npm run build
if [ $? -eq 0 ]; then
    echo "✅ Frontend compilado!"
else
    echo "❌ Erro ao compilar frontend!"
    exit 1
fi
echo ""

# Passo 4: Reiniciar serviços PM2
echo "🔄 4. Reiniciando serviços PM2..."
echo "   → Reiniciando backend..."
pm2 restart whatsapp-backend
echo "   → Reiniciando frontend..."
pm2 restart whatsapp-frontend
echo "✅ Serviços reiniciados!"
echo ""

# Passo 5: Verificar status
echo "📊 5. Status dos serviços:"
pm2 status
echo ""

echo "=========================================="
echo "✅ ATUALIZAÇÃO CONCLUÍDA COM SUCESSO!"
echo "=========================================="
echo ""
echo "🌐 Acesse: https://sistemasnettsistemas.com.br"
echo "💡 Use Ctrl + Shift + R para recarregar sem cache"
echo ""

