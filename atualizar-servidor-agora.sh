#!/bin/bash
echo "=========================================="
echo "ATUALIZANDO SERVIDOR - $(date)"
echo "=========================================="
echo ""

cd /root/whatsapp-dispatcher

echo "1. Git pull..."
git pull origin main
echo "Git pull concluído!"
echo ""

echo "2. Removendo dist..."
cd backend
rm -rf dist
echo "Dist removido!"
echo ""

echo "3. Compilando backend..."
npm run build
echo "Backend compilado!"
echo ""

echo "4. Reiniciando PM2..."
pm2 restart whatsapp-backend
echo "PM2 reiniciado!"
echo ""

echo "5. Status do PM2:"
pm2 status whatsapp-backend
echo ""

echo "=========================================="
echo "ATUALIZAÇÃO CONCLUÍDA!"
echo "=========================================="









