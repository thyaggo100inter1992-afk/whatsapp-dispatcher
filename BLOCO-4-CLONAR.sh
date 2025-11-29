#!/bin/bash
# ============================================
# BLOCO 4: CLONAR REPOSITÓRIO
# Execute DEPOIS do Bloco 3
# ============================================

echo "==================================="
echo "📥 CLONANDO REPOSITÓRIO DO GITHUB..."
echo "==================================="

cd /root

# Se já existir, remover
if [ -d "whatsapp-dispatcher" ]; then
    echo "⚠️ Pasta já existe, removendo..."
    rm -rf whatsapp-dispatcher
fi

git clone https://github.com/thyaggo100inter1992-afk/whatsapp-dispatcher.git

cd whatsapp-dispatcher

echo ""
echo "✅ Repositório clonado!"
echo "Arquivos na pasta:"
ls -la | head -20

echo "==================================="
echo "✅ BLOCO 4 CONCLUÍDO!"
echo "==================================="

